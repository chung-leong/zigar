const std = @import("std");

const V8Value = *opaque {};
const V8CallbackInfo = *opaque {};

const Pool = extern struct {
    allocator: *const std.mem.Allocator,
    allocate: *const fn (allocator: *std.mem.Allocator, count: usize) callconv(.C) ?[*]u8,
};

const V8Callbacks = extern struct {
    get_argument_count: *const fn (info: V8CallbackInfo) callconv(.C) usize,
    get_argument: *const fn (info: V8CallbackInfo, index: usize) callconv(.C) V8Value,

    is_null: *const fn (info: V8CallbackInfo, value: V8Value) callconv(.C) bool,

    convert_to_boolean: *const fn (info: V8CallbackInfo, value: V8Value, dest: *bool) callconv(.C) c_int,
    convert_to_i32: *const fn (info: V8CallbackInfo, value: V8Value, dest: *i32) callconv(.C) c_int,
    convert_to_u32: *const fn (info: V8CallbackInfo, value: V8Value, dest: *u32) callconv(.C) c_int,
    convert_to_i64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *i64) callconv(.C) c_int,
    convert_to_u64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *u64) callconv(.C) c_int,
    convert_to_f64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *f64) callconv(.C) c_int,
    convert_to_utf8: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*:0]const u8, dest_len: *usize, pool: *Pool) callconv(.C) c_int,
    convert_to_utf16: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*:0]const u16, dest_len: *usize, pool: *Pool) callconv(.C) c_int,
    convert_to_buffer: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*]const u8, dest_len: *usize) callconv(.C) c_int,
};

fn IntermediateType(comptime T: type) type {
    return switch (T) {
        i8, i16 => i32,
        u8, u16 => u32,
        f16, f32, f80, f128 => f64,
        else => T,
    };
}

fn isScalar(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float => true,
        else => false,
    };
}

const Result = enum {
    Success,
    Failure,
};

const Error = error{
    UnsupportedConversion,
    IntegerUnderflow,
    IntegerOverflow,
    FloatUnderflow,
    FloatOverflow,
};

fn checkOverflow(value: anytype, comptime T: type) !void {
    switch (@typeInfo(T)) {
        .Int => {
            const min = std.math.minInt(T);
            const max = std.math.maxInt(T);
            if (value < min) {
                return Error.IntegerUnderflow;
            } else if (value > max) {
                return Error.IntegerOverflow;
            }
        },
        .Float => {
            const min = @field(std.math, @typeName(T) ++ "_min");
            const max = @field(std.math, @typeName(T) ++ "_max");
            if (value < min) {
                return Error.FloatUnderflow;
            } else if (value > max) {
                return Error.FloatOverflow;
            }
        },
    }
}

fn coerce(info: V8CallbackInfo, callbacks: V8Callbacks, value: V8Value, comptime T: type, pool: *Pool) !T {
    _ = pool;
    const type_info = @typeInfo(T);
    return switch (type_info) {
        .Optional => {
            if (callbacks.is_null(info, value)) {
                return null;
            } else {
                return coerce(info, callbacks, value, type_info.child);
            }
        },
        .ErrorUnion => {
            return coerce(info, callbacks, type_info.target);
        },
        else => {
            if (isScalar(T)) {
                const IntermediateT = IntermediateType(T);
                const callback = @field(callbacks, "convert_to_" ++ @typeName(IntermediateT));
                const result: T = undefined;
                if (callback(info, value, result) != Result.Success) {
                    return Error.UnsupportedConversion;
                }
                if (T != IntermediateT) {
                    try checkOverflow(result, T);
                }
                return result;
            } else {
                return Error.UnsupportedConversion;
            }
        },
    };
}

fn throwException(info: V8CallbackInfo, callbacks: V8Callbacks, comptime fmt: *[*:0]const u8, comptime vars: anytype, allocator: std.mem.Allocator) void {
    const result = std.fmt.allocPrintZ(allocator, fmt, vars);
    if (result) |message| {
        callbacks.throw_exception(info, message);
    }
}

const Thunk = *const fn (info: V8CallbackInfo, callbacks: V8Callbacks) callconv(.C) void;

fn createThunk(comptime name: []const u8, comptime zig_fn: anytype) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(zig_fn));
    const ThunkType = struct {
        fn allocate(allocator: *std.mem.Allocator, size: usize) callconv(.C) ?[*]u8 {
            var array = allocator.alloc(u8, size) catch null;
            return @ptrCast(?[*]u8, &array);
        }

        fn cfn(info: V8CallbackInfo, callbacks: V8Callbacks) callconv(.C) void {
            var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
            const allocator = arena.allocator();
            defer arena.deinit();
            const pool: Pool = .{ .allocator = &allocator, .allocate = &allocate };
            var args: Args = undefined;
            for (std.meta.fields(Args), 0..) |field, index| {
                const arg = callbacks.get_argument(info, index);
                const result = coerce(info, callbacks, arg, field.field_type, pool);
                if (result) |value| {
                    args[index] = value;
                } else |err| {
                    const arg_count = callbacks.get_argument_count(info);
                    var fmt = undefined;
                    var vars = undefined;
                    if (Error.TypeCoercionFailed and arg_count < args.len) {
                        fmt = "{s}() expects {d} argument(s), {d} given";
                        vars = .{ name, args.len, arg_count };
                    } else {
                        fmt = "Error encounter while converting JavaScript value to {s} for argument {d} of {s}(): {s}";
                        vars = .{ field.type_name, @typeName(field.type), index + 1, name, @errorName(err) };
                    }
                    throwException(info, callbacks, fmt, vars, allocator);
                    return;
                }
            }
            _ = @call(std.builtin.CallModifier.auto, zig_fn, args);
        }
    };
    return ThunkType.cfn;
}

const FunctionRecord = extern struct {
    arg_count: usize,
    thunk: Thunk,
};

fn createFunction(comptime name: []const u8, comptime zig_fn: anytype) FunctionRecord {
    const arg_count = @typeInfo(@TypeOf(zig_fn)).Fn.params.len;
    return .{
        .arg_count = arg_count,
        .thunk = createThunk(name, zig_fn),
    };
}

fn CArray(comptime T: type) type {
    return extern struct {
        items: [*]const T,
        count: usize,
    };
}

fn ChildType(comptime array: anytype) type {
    const T = @TypeOf(array);
    return switch (@typeInfo(T)) {
        .Array => |info| info.child,
        else => @compileError("Expected array, found '" ++ @typeName(T) ++ "'"),
    };
}

fn ArrayType(comptime slice: anytype) type {
    const T = @TypeOf(slice);
    return switch (@typeInfo(T)) {
        .Pointer => |info| info.child,
        else => @compileError("Expected slice, found '" ++ @typeName(T) ++ "'"),
    };
}

fn reifySlice(comptime slice: anytype) ArrayType(slice) {
    var array: ArrayType(slice) = undefined;
    for (slice, 0..) |item, index| {
        array[index] = item;
    }
    return array;
}

fn createArray(comptime array: anytype) CArray(ChildType(array)) {
    return .{ .items = &array, .count = array.len };
}

fn createString(comptime s: []const u8) [*:0]const u8 {
    return @ptrCast([*:0]const u8, s);
}

const EnumRecord = extern struct {
    name: [*:0]const u8,
    value: c_int,
};

fn createEnumSet(comptime T: anytype) CArray(EnumRecord) {
    const fields = std.meta.fields(T);
    var entries: [fields.len]EnumRecord = undefined;
    for (fields, 0..) |field, index| {
        entries[index] = .{
            .name = createString(field.name),
            .value = field.value,
        };
    }
    return createArray(entries);
}

const EntryType = enum(c_int) {
    unavailable = 0,
    function,
    enum_set,
    enum_value,
    object,
    int_value,
    float_value,
};

const EntryParams = extern union {
    fn_record: FunctionRecord,
    enum_set: CArray(EnumRecord),
    int_value: i64,
    float_value: f64,
};

const EntryContent = extern struct {
    type: EntryType,
    params: EntryParams,
};

const Entry = extern struct {
    name: [*:0]const u8,
    content: EntryContent,
};

fn createEntryContent(comptime name: []const u8, comptime field: anytype) EntryContent {
    const T = @TypeOf(field);
    return switch (@typeInfo(T)) {
        .Type => switch (@typeInfo(field)) {
            .Enum => .{
                .type = EntryType.enum_set,
                .params = .{ .enum_set = createEnumSet(field) },
            },
            else => .{
                .type = EntryType.unavailable,
                .params = .{ .int_value = 0 },
            },
        },
        .Fn => .{
            .type = EntryType.function,
            .params = .{ .fn_record = createFunction(name, field) },
        },
        .Enum => .{
            .type = EntryType.enum_value,
            .params = .{ .int_value = @enumToInt(field) },
        },
        .Int, .ComptimeInt => .{
            .type = EntryType.int_value,
            .params = .{ .int_value = field },
        },
        .Float, .ComptimeFloat => .{
            .type = EntryType.float_value,
            .params = .{ .float_value = field },
        },
        else => .{
            .type = EntryType.unavailable,
            .params = .{ .int_value = 0 },
        },
    };
}

const EntryTable = CArray(Entry);

fn createEntryTable(comptime section: anytype) EntryTable {
    const decls = @typeInfo(section).Struct.decls;
    var entries: [decls.len]Entry = undefined;
    var index = 0;
    for (decls) |decl| {
        if (decl.is_pub) {
            const field = @field(section, decl.name);
            const content = createEntryContent(decl.name, field);
            if (content.type != EntryType.unavailable) {
                entries[index] = .{
                    .name = createString(decl.name),
                    .content = content,
                };
                index += 1;
            }
        }
    }
    return createArray(reifySlice(entries[0..index]));
}

export const zig_module = createEntryTable(@import("./functions.zig"));

test "module content" {
    std.debug.print("\n", .{});
    for (zig_module.items, 0..zig_module.count) |entry, _| {
        std.debug.print("{s}\t", .{entry.name});
        switch (entry.content.type) {
            EntryType.function => std.debug.print("[function]\n", .{}),
            EntryType.enum_set => {
                std.debug.print("enum {{\n", .{});
                const items = entry.content.params.enum_set.items;
                const count = entry.content.params.enum_set.count;
                for (items, 0..count) |item, _| {
                    std.debug.print("  {s} = {d}\n", .{ item.name, item.value });
                }
                std.debug.print("}}\n", .{});
            },
            EntryType.int_value, EntryType.enum_value => std.debug.print("{d}\n", .{entry.content.params.int_value}),
            EntryType.float_value => std.debug.print("{d}\n", .{entry.content.params.float_value}),
            else => {
                std.debug.print("[unknown]\n", .{});
            },
        }
    }
}
