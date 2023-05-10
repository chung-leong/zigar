const std = @import("std");

const V8Value = *opaque {};
const V8CallbackInfo = *opaque {};

const Pool = extern struct {
    allocator: std.mem.Allocator,
    allocate: *const fn (allocator: std.mem.Allocator, count: c_int) [*]u8,
};

const V8Callbacks = extern struct {
    get_argument_count: *const fn (info: V8CallbackInfo) usize,
    get_argument: *const fn (info: V8CallbackInfo, index: usize) V8Value,

    is_null: *const fn (info: V8CallbackInfo, value: V8Value) bool,

    convert_to_boolean: *const fn (info: V8CallbackInfo, value: V8Value, dest: *bool) c_int,
    convert_to_i32: *const fn (info: V8CallbackInfo, value: V8Value, dest: *i32) c_int,
    convert_to_u32: *const fn (info: V8CallbackInfo, value: V8Value, dest: *u32) c_int,
    convert_to_i64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *i64) c_int,
    convert_to_u64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *u64) c_int,
    convert_to_f64: *const fn (info: V8CallbackInfo, value: V8Value, dest: *f64) c_int,
    convert_to_utf8: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*:0]const u8, dest_len: *usize, pool: Pool) c_int,
    convert_to_utf16: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*:0]const u16, dest_len: *usize, pool: Pool) c_int,
    convert_to_buffer: *const fn (info: V8CallbackInfo, value: V8Value, dest: *[*]const u8, dest_len: *usize) c_int,
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
    Success = 0,
    Failure = 1,
};

const Error = error{
    TypeCoercionFailed,
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

fn coerce(info: V8CallbackInfo, callbacks: V8Callbacks, value: V8Value, comptime T: type, pool: Pool) !T {
    const type_info = @typeInfo(T);
    return switch (type_info) {
        .Optional => {
            if (callbacks.is_null(info, value)) {
                return null;
            } else {
                return coerce(info, callbacks, v8value, type_info.child);
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
                if (callback(info, v8value, result) != Result.Success) {
                    return Error.TypeCoercionFailed;
                }
                if (T != IntermediateT) {
                    try checkOverflow(result, T);
                }
                return result;
            } else {
                return Error.TypeCoercionFailed;
            }
        },
    };
}

fn throwException(info: V8CallbackInfo, callbacks: V8Callbacks, comptime fmt: *[*:0]const u8, comptime args: anytype, pool: Pool) void {
    try {
        const message = std.fmt.allocPrintZ(pool.allocator, fmt, args);
        callbacks.throw_exception(info, message);

    }
}

const Thunk = *const fn (info: V8CallbackInfo, callbacks: V8Callbacks) callconv(.C) void;

fn createThunk(comptime zig_fn: anytype) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(zig_fn));
    const ThunkType = struct {
        fn cfn(info: V8CallbackInfo, callbacks: V8Callbacks) callconv(.C) void {
            var args: Args = undefined;
            for (std.meta.fields(Args), 0..) |field, index| {
                const arg = callbacks.get_argument(info, index);
                const result = coerce(info, callbacks, arg, field.field_type);
                if (result) |value| {
                    args[index] = value;
                } else |err| {
                    throwException(info, callbacks, err);
                }
            }
            const result = @call(std.builtin.CallModifier.auto, zig_fn, args);
            if (reuslt) |value| => {
                // TODO: set return value
            }
        }
    };
    return ThunkType.cfn;
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
        .Pointer => |info| info.child,
        else => @compileError("Expected array or slice, found '" ++ @typeName(T) ++ "'"),
    };
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

const FunctionRecord = extern struct {
    arg_count: c_int,
    thunk: Thunk,
};

const EntryParams = extern union {
    fn_record: FunctionRecord,
    enum_set: *const CArray(EnumRecord),
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

fn createEntryContent(comptime field: anytype) EntryContent {
    const T = @TypeOf(field);
    return switch (@typeInfo(T)) {
        .Type => switch (@typeInfo(field)) {
            .Enum => .{
                .type = EntryType.enum_set,
                .params = .{ .enum_entries = &createEnumSet(field) },
            },
            else => .{
                .type = EntryType.unavailable,
                .params = .{ .int_value = 0 },
            },
        },
        .Fn => .{
            .type = EntryType.function,
            .params = .{ .fn_thunk = createThunk(field) },
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

const imported = @import("./functions.zig");
export const zig_module = init: {
    const decls = @typeInfo(imported).Struct.decls;
    var entries: [decls.len]Entry = undefined;
    for (decls, 0..) |decl, index| {
        if (decl.is_pub) {
            const field = @field(imported, decl.name);
            entries[index] = .{
                .name = createString(decl.name),
                .content = createEntryContent(field),
            };
        }
    }
    break :init createArray(entries);
};
