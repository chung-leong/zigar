const std = @import("std");

const V8Value = *opaque {};
const V8CallbackInfo = *opaque {};

const PoolRecord = extern struct {
    allocator: *std.mem.Allocator,
    allocate: *const fn (allocator: *std.mem.Allocator, count: usize) callconv(.C) ?[*]u8,
};
const Pool = *const PoolRecord;

const V8CallbackTable = extern struct {
    get_argument_count: *const fn (info: V8CallbackInfo) callconv(.C) usize,
    get_argument: *const fn (info: V8CallbackInfo, index: usize) callconv(.C) V8Value,

    is_null: *const fn (info: V8CallbackInfo, value: V8Value) callconv(.C) bool,

    convert_to_boolean: *const fn (info: V8CallbackInfo, value: V8Value, dest: *bool) callconv(.C) c_int,
    convert_to_i32: *const fn (info: V8CallbackInfo, value: V8Value, dest: *i32) callconv(.C) c_int,
    convert_to_u32: *const fn (info: V8CallbackInfo, value: V8Value, dest: *u32) callconv(.C) c_int,
    convert_to_i64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *i64) callconv(.C) c_int,
    convert_to_u64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *u64) callconv(.C) c_int,
    convert_to_f64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *f64) callconv(.C) c_int,
    convert_to_utf8: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*:0]const u8, dest_len: *usize, pool: Pool) callconv(.C) c_int,
    convert_to_utf16: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*:0]const u16, dest_len: *usize, pool: Pool) callconv(.C) c_int,
    convert_to_buffer: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*]const u8, dest_len: *usize) callconv(.C) c_int,

    throw_exception: *const fn (info: V8CallbackInfo, message: [*:0]const u8) void,
};
const V8Callbacks = *const V8CallbackTable;

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
    IntegerOverflow,
    FloatUnderflow,
    FloatOverflow,
};

fn checkOverflow(value: anytype, comptime T: type) !void {
    switch (@typeInfo(T)) {
        .Int => {
            const max = std.math.maxInt(T);
            if (value > max) {
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
        else => {},
    }
}

fn isOptional(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Optional => true,
        else => false,
    };
}

fn BaseType(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .Optional => |opt| BaseType(opt.child),
        .ErrorUnion => |eu| BaseType(eu.target),
        else => T,
    };
}

fn coerce(info: V8CallbackInfo, callbacks: V8Callbacks, value: V8Value, comptime T: type, pool: Pool) !T {
    _ = pool;
    if (comptime isOptional(T)) {
        if (callbacks.is_null(info, value)) {
            return null;
        }
    }
    const BT = BaseType(T);
    if (comptime isScalar(BT)) {
        const IT = IntermediateType(BT);
        const callback = @field(callbacks, "convert_to_" ++ @typeName(IT));
        var result: IT = undefined;
        var retval = callback(info, value, &result);
        if (@intToEnum(Result, retval) != Result.Success) {
            return Error.UnsupportedConversion;
        }
        if (BT != IT) {
            // TODO: handle float
            try checkOverflow(result, BT);
            return @intCast(BT, result);
        } else {
            return result;
        }
    } else {
        return Error.UnsupportedConversion;
    }
}

fn throwException(info: V8CallbackInfo, callbacks: V8Callbacks, comptime fmt: []const u8, vars: anytype) void {
    var buffer: [1024]u8 = undefined;
    const message = std.fmt.bufPrint(&buffer, fmt, vars) catch fmt;
    callbacks.throw_exception(info, @ptrCast([*:0]const u8, message.ptr));
}

const Thunk = *const fn (info: V8CallbackInfo, callbacks: V8Callbacks) callconv(.C) void;

fn createThunk(comptime name: []const u8, comptime zig_fn: anytype) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(zig_fn));
    const ThunkType = struct {
        fn allocate(allocator: *std.mem.Allocator, size: usize) callconv(.C) ?[*]u8 {
            var array = allocator.alloc(u8, size) catch null;
            return @ptrCast(?[*]u8, &array);
        }

        fn ga(info: V8CallbackInfo, callbacks: V8Callbacks, index: usize, count: i32, comptime T: type, pool: Pool) ?T {
            const arg = callbacks.get_argument(info, index);
            const result = coerce(info, callbacks, arg, T, pool);
            if (result) |value| {
                return value;
            } else |err| {
                const arg_count = callbacks.get_argument_count(info);
                if (err == Error.UnsupportedConversion and arg_count < count) {
                    throwException(
                        info,
                        callbacks,
                        "{s}() expects {d} argument(s), {d} given",
                        .{ name, count, arg_count },
                    );
                } else {
                    throwException(
                        info,
                        callbacks,
                        "Error encounter while converting JavaScript value to {s} for argument {d} of {s}(): {s}",
                        .{ @typeName(T), index + 1, name, @errorName(err) },
                    );
                }
                return null;
            }
        }

        fn cfn(info: V8CallbackInfo, cb: V8Callbacks) callconv(.C) void {
            var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
            var allocator = arena.allocator();
            defer arena.deinit();
            const p: Pool = &PoolRecord{ .allocator = &allocator, .allocate = &allocate };
            var args: Args = undefined;
            const f = std.meta.fields(Args);
            const l = f.len;
            if (l > 32) {
                throwException(info, cb, "{s}() has more than 32 arguments", .{name});
                return;
            }
            // can't loop through fields at comptime :-(
            if (l > 0) args[0] = ga(info, cb, 0, l, f[0].type, p) orelse return;
            if (l > 1) args[1] = ga(info, cb, 1, l, f[1].type, p) orelse return;
            if (l > 2) args[2] = ga(info, cb, 2, l, f[2].type, p) orelse return;
            if (l > 3) args[3] = ga(info, cb, 3, l, f[3].type, p) orelse return;
            if (l > 4) args[4] = ga(info, cb, 4, l, f[4].type, p) orelse return;
            if (l > 5) args[5] = ga(info, cb, 5, l, f[5].type, p) orelse return;
            if (l > 6) args[6] = ga(info, cb, 6, l, f[6].type, p) orelse return;
            if (l > 7) args[7] = ga(info, cb, 7, l, f[7].type, p) orelse return;
            if (l > 8) args[8] = ga(info, cb, 8, l, f[8].type, p) orelse return;
            if (l > 9) args[9] = ga(info, cb, 9, l, f[9].type, p) orelse return;
            if (l > 10) args[10] = ga(info, cb, 10, l, f[10].type, p) orelse return;
            if (l > 11) args[11] = ga(info, cb, 11, l, f[11].type, p) orelse return;
            if (l > 12) args[12] = ga(info, cb, 12, l, f[12].type, p) orelse return;
            if (l > 13) args[13] = ga(info, cb, 13, l, f[13].type, p) orelse return;
            if (l > 14) args[14] = ga(info, cb, 14, l, f[14].type, p) orelse return;
            if (l > 15) args[15] = ga(info, cb, 15, l, f[15].type, p) orelse return;
            if (l > 16) args[16] = ga(info, cb, 16, l, f[16].type, p) orelse return;
            if (l > 17) args[17] = ga(info, cb, 17, l, f[17].type, p) orelse return;
            if (l > 18) args[18] = ga(info, cb, 18, l, f[18].type, p) orelse return;
            if (l > 19) args[19] = ga(info, cb, 19, l, f[19].type, p) orelse return;
            if (l > 20) args[20] = ga(info, cb, 20, l, f[20].type, p) orelse return;
            if (l > 21) args[21] = ga(info, cb, 21, l, f[21].type, p) orelse return;
            if (l > 22) args[22] = ga(info, cb, 22, l, f[22].type, p) orelse return;
            if (l > 23) args[23] = ga(info, cb, 23, l, f[23].type, p) orelse return;
            if (l > 24) args[24] = ga(info, cb, 24, l, f[24].type, p) orelse return;
            if (l > 25) args[25] = ga(info, cb, 25, l, f[25].type, p) orelse return;
            if (l > 26) args[26] = ga(info, cb, 26, l, f[26].type, p) orelse return;
            if (l > 27) args[27] = ga(info, cb, 27, l, f[27].type, p) orelse return;
            if (l > 28) args[28] = ga(info, cb, 28, l, f[28].type, p) orelse return;
            if (l > 29) args[29] = ga(info, cb, 29, l, f[29].type, p) orelse return;
            if (l > 30) args[30] = ga(info, cb, 30, l, f[30].type, p) orelse return;
            if (l > 31) args[31] = ga(info, cb, 31, l, f[31].type, p) orelse return;

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
        .Array => |ar| ar.child,
        else => @compileError("Expected array, found '" ++ @typeName(T) ++ "'"),
    };
}

fn ArrayType(comptime slice: anytype) type {
    const T = @TypeOf(slice);
    return switch (@typeInfo(T)) {
        .Pointer => |pt| pt.child,
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
