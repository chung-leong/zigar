const std = @import("std");
pub const api_version = 1;

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

const Value = *opaque {};
const Pool = *opaque {};
const Isolate = *opaque {};
const CallInfo = *opaque {};
const Memory = extern struct {
    len: usize,
    bytes: [*]u8,
};
const Callbacks = extern struct {
    get_argument_count: *const fn (info: CallInfo) callconv(.C) usize,
    get_argument: *const fn (info: CallInfo, index: usize) callconv(.C) Value,
    set_return_value: *const fn (info: CallInfo, retval: ?Value) callconv(.C) void,

    is_null: *const fn (value: Value) callconv(.C) bool,
    is_array_buffer: *const fn (value: Value) callconv(.C) bool,

    convert_to_bool: *const fn (isolate: Isolate, value: Value, dest: *bool) callconv(.C) c_int,
    convert_to_i32: *const fn (isolate: Isolate, value: Value, dest: *i32) callconv(.C) c_int,
    convert_to_u32: *const fn (isolate: Isolate, value: Value, dest: *u32) callconv(.C) c_int,
    convert_to_i64: *const fn (isolate: Isolate, value: Value, dest: *i64) callconv(.C) c_int,
    convert_to_u64: *const fn (isolate: Isolate, value: Value, dest: *u64) callconv(.C) c_int,
    convert_to_f64: *const fn (isolate: Isolate, value: Value, dest: *f64) callconv(.C) c_int,
    convert_to_utf8: *const fn (isolate: Isolate, value: Value, pool: Pool, dest: *Memory) callconv(.C) c_int,
    convert_to_utf16: *const fn (isolate: Isolate, value: Value, pool: Pool, dest: *Memory) callconv(.C) c_int,
    convert_to_buffer: *const fn (isolate: Isolate, value: Value, dest: *Memory) callconv(.C) c_int,

    convert_from_bool: *const fn (isolate: Isolate, value: bool, dest: *Value) callconv(.C) c_int,
    convert_from_i32: *const fn (isolate: Isolate, value: i32, dest: *Value) callconv(.C) c_int,
    convert_from_u32: *const fn (isolate: Isolate, value: u32, dest: *Value) callconv(.C) c_int,
    convert_from_i64: *const fn (isolate: Isolate, value: i64, dest: *Value) callconv(.C) c_int,
    convert_from_u64: *const fn (isolate: Isolate, value: u64, dest: *Value) callconv(.C) c_int,
    convert_from_f64: *const fn (isolate: Isolate, value: f64, dest: *Value) callconv(.C) c_int,

    throw_exception: *const fn (isolate: Isolate, message: [*:0]const u8) void,
};
const Thunk = *const fn (isolate: Isolate, info: CallInfo, pool: Pool) callconv(.C) void;

fn CArray(comptime T: type) type {
    return extern struct {
        items: [*]const T,
        count: usize,
    };
}

const EntryType = enum(c_int) {
    unavailable = 0,
    function,
    variable,
    enumeration,
};
const Function = extern struct {
    thunk: Thunk,
    arg_count: usize,
};
const Variable = extern struct {
    getter_thunk: Thunk,
    setter_thunk: ?Thunk,
};
const EnumerationItem = extern struct {
    name: [*:0]const u8,
    value: c_int,
};
const Enumeration = CArray(EnumerationItem);
const EntryParams = extern union {
    function: Function,
    variable: Variable,
    enumeration: Enumeration,
};
const EntryContent = extern struct {
    type: EntryType,
    params: EntryParams,
};
const Entry = extern struct {
    name: [*:0]const u8,
    content: EntryContent,
};
const EntryTable = CArray(Entry);
const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    entries: EntryTable,
};

var callbacks: Callbacks = undefined;

fn isScalar(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float => true,
        else => false,
    };
}

fn isArray(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Array => true,
        else => false,
    };
}

fn isSlice(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Pointer => |pt| pt.size == std.builtin.Type.Pointer.Size.Slice,
        else => false,
    };
}

fn isArrayLike(comptime T: type) bool {
    return isArray(T) or isSlice(T);
}

fn isInt(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int => true,
        else => false,
    };
}

fn isFloat(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Float => true,
        else => false,
    };
}

fn isOptional(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Optional => true,
        else => false,
    };
}

fn isErrorUnion(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .ErrorUnion => true,
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

fn ChildType(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .Array => |ar| ar.child,
        .Pointer => |pt| pt.child,
        else => @compileError("Expected array or pointer type, found '" ++ @typeName(T) ++ "'"),
    };
}

fn IntermediateType(comptime T: type) type {
    return switch (T) {
        i8, i16 => i32,
        u8, u16 => u32,
        f16, f32, f80, f128 => f64,
        else => T,
    };
}

fn checkOverflow(value: anytype, comptime T: type) !void {
    switch (@typeInfo(T)) {
        .Int => {
            if (value > std.math.maxInt(T)) {
                return Error.IntegerOverflow;
            }
        },
        .Float => {
            if (value < @field(std.math, @typeName(T) ++ "_min")) {
                return Error.FloatUnderflow;
            } else if (value > @field(std.math, @typeName(T) ++ "_max")) {
                return Error.FloatOverflow;
            }
        },
        else => {},
    }
}

fn convertTo(isolate: Isolate, pool: Pool, value: Value, comptime T: type) !T {
    if (comptime isOptional(T)) {
        if (callbacks.is_null(isolate, value)) {
            return null;
        }
    }
    const BT = BaseType(T);

    if (comptime isScalar(BT)) {
        const IT = IntermediateType(BT);
        const callback = @field(callbacks, "convert_to_" ++ @typeName(IT));
        var result: IT = undefined;
        var retval = callback(isolate, value, &result);
        if (@intToEnum(Result, retval) != Result.Success) {
            return Error.UnsupportedConversion;
        }
        if (comptime BT != IT) {
            // need to check for overflow and cast to final type
            try checkOverflow(result, BT);
            return if (comptime isInt(T)) @intCast(BT, result) else @floatCast(BT, result);
        }
        return result;
    } else if (comptime isArrayLike(T)) {
        const CT = ChildType(T);
        if (CT == u8 or CT == u16) {
            // convert to string unless incoming value is an ArrayBuffer
            if (!callbacks.is_array_buffer(isolate, value)) {
                const width = if (CT == u8) "8" else "16";
                const callback = @field(callbacks, "convert_to_utf" ++ width);
                var result: Memory = undefined;
                var retval = callback(isolate, value, pool, &result);
                if (@intToEnum(Result, retval) != Result.Success) {
                    return Error.UnsupportedConversion;
                }
                var len = if (CT == u8) result.len else result.len >> 1;
                const ptr = @ptrCast([*]CT, @alignCast(@alignOf(CT), result.bytes));
                return ptr[0..len];
            }
        }
    }
    return Error.UnsupportedConversion;
}

fn convertFrom(isolate: Isolate, pool: Pool, value: anytype) !?Value {
    const T = @TypeOf(value);
    if (T == void) {
        return null;
    }
    if (comptime isOptional(T)) {
        return if (value) |v| convertFrom(isolate, pool, v) else null;
    }
    if (comptime isScalar(T)) {
        const IT = IntermediateType(T);
        const i_value: IT = if (comptime isFloat(T)) @floatCast(IT, value) else value;
        const callback = @field(callbacks, "convert_from_" ++ @typeName(IT));
        var result: Value = undefined;
        var retval = callback(isolate, i_value, &result);
        if (@intToEnum(Result, retval) != Result.Success) {
            return Error.UnsupportedConversion;
        }
        return result;
    }
    return Error.UnsupportedConversion;
}

fn throwException(isolate: Isolate, comptime fmt: []const u8, vars: anytype) void {
    var buffer: [1024]u8 = undefined;
    const message = std.fmt.bufPrint(&buffer, fmt, vars) catch fmt;
    callbacks.throw_exception(isolate, @ptrCast([*:0]const u8, message.ptr));
}

fn createThunk(comptime name: []const u8, comptime zig_fn: anytype) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(zig_fn));
    const ThunkType = struct {
        fn ga(isolate: Isolate, info: CallInfo, pool: Pool, index_ptr: *usize, count: i32, comptime T: type) ?T {
            if (T == std.mem.Allocator) {
                // TODO: provide allocator
                return null;
            } else {
                const index: usize = index_ptr.*;
                index_ptr.* = index + 1;
                const arg = callbacks.get_argument(info, index);
                if (convertTo(isolate, pool, arg, T)) |value| {
                    return value;
                } else |err| {
                    const arg_count = callbacks.get_argument_count(info);
                    if (err == Error.UnsupportedConversion and arg_count < count) {
                        const fmt = "{s}() expects {d} argument(s), {d} given";
                        throwException(isolate, fmt, .{ name, count, arg_count });
                    } else {
                        const fmt = "Error encountered while converting JavaScript value to {s} for argument {d} of {s}(): {s}";
                        throwException(isolate, fmt, .{ @typeName(T), index + 1, name, @errorName(err) });
                    }
                    return null;
                }
            }
        }

        fn cfn(iso: Isolate, info: CallInfo, pool: Pool) callconv(.C) void {
            var args: Args = undefined;
            const f = std.meta.fields(Args);
            const c = f.len;
            // can't loop through fields at comptime :-(
            if (c > 32) {
                throwException(iso, "{s}() has more than 32 arguments", .{name});
                return;
            }
            var i: usize = 0;
            if (c > 0) args[0] = ga(iso, info, pool, &i, c, f[0].type) orelse return;
            if (c > 1) args[1] = ga(iso, info, pool, &i, c, f[1].type) orelse return;
            if (c > 2) args[2] = ga(iso, info, pool, &i, c, f[2].type) orelse return;
            if (c > 3) args[3] = ga(iso, info, pool, &i, c, f[3].type) orelse return;
            if (c > 4) args[4] = ga(iso, info, pool, &i, c, f[4].type) orelse return;
            if (c > 5) args[5] = ga(iso, info, pool, &i, c, f[5].type) orelse return;
            if (c > 6) args[6] = ga(iso, info, pool, &i, c, f[6].type) orelse return;
            if (c > 7) args[7] = ga(iso, info, pool, &i, c, f[7].type) orelse return;
            if (c > 8) args[8] = ga(iso, info, pool, &i, c, f[8].type) orelse return;
            if (c > 9) args[9] = ga(iso, info, pool, &i, c, f[9].type) orelse return;
            if (c > 10) args[10] = ga(iso, info, pool, &i, c, f[10].type) orelse return;
            if (c > 11) args[11] = ga(iso, info, pool, &i, c, f[11].type) orelse return;
            if (c > 12) args[12] = ga(iso, info, pool, &i, c, f[12].type) orelse return;
            if (c > 13) args[13] = ga(iso, info, pool, &i, c, f[13].type) orelse return;
            if (c > 14) args[14] = ga(iso, info, pool, &i, c, f[14].type) orelse return;
            if (c > 15) args[15] = ga(iso, info, pool, &i, c, f[15].type) orelse return;
            if (c > 16) args[16] = ga(iso, info, pool, &i, c, f[16].type) orelse return;
            if (c > 17) args[17] = ga(iso, info, pool, &i, c, f[17].type) orelse return;
            if (c > 18) args[18] = ga(iso, info, pool, &i, c, f[18].type) orelse return;
            if (c > 19) args[19] = ga(iso, info, pool, &i, c, f[19].type) orelse return;
            if (c > 20) args[20] = ga(iso, info, pool, &i, c, f[20].type) orelse return;
            if (c > 21) args[21] = ga(iso, info, pool, &i, c, f[21].type) orelse return;
            if (c > 22) args[22] = ga(iso, info, pool, &i, c, f[22].type) orelse return;
            if (c > 23) args[23] = ga(iso, info, pool, &i, c, f[23].type) orelse return;
            if (c > 24) args[24] = ga(iso, info, pool, &i, c, f[24].type) orelse return;
            if (c > 25) args[25] = ga(iso, info, pool, &i, c, f[25].type) orelse return;
            if (c > 26) args[26] = ga(iso, info, pool, &i, c, f[26].type) orelse return;
            if (c > 27) args[27] = ga(iso, info, pool, &i, c, f[27].type) orelse return;
            if (c > 28) args[28] = ga(iso, info, pool, &i, c, f[28].type) orelse return;
            if (c > 29) args[29] = ga(iso, info, pool, &i, c, f[29].type) orelse return;
            if (c > 30) args[30] = ga(iso, info, pool, &i, c, f[30].type) orelse return;
            if (c > 31) args[31] = ga(iso, info, pool, &i, c, f[31].type) orelse return;

            var result = @call(std.builtin.CallModifier.auto, zig_fn, args);
            var retval: anyerror!?Value = null;
            if (comptime isErrorUnion(@TypeOf(result))) {
                if (result) |value| {
                    retval = convertFrom(iso, pool, value);
                } else |err| {
                    throwException(iso, "Error encountered in {s}(): {s}", .{ name, @errorName(err) });
                    return;
                }
            } else {
                retval = convertFrom(iso, pool, result);
            }
            if (retval) |value| {
                callbacks.set_return_value(info, value);
            } else |err| {
                const T = BaseType(@TypeOf(result));
                const fmt = "Error encountered while converting {s} to JavaScript value: {s}";
                throwException(iso, fmt, .{ @typeName(T), @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.cfn;
}

fn createGetterThunk(comptime name: []const u8, comptime package: anytype) Thunk {
    const ThunkType = struct {
        fn cfn(iso: Isolate, info: CallInfo, pool: Pool) callconv(.C) void {
            const field = @field(package, name);
            const T = @TypeOf(field);
            if (convertFrom(iso, pool, field)) |v| {
                callbacks.set_return_value(info, v);
            } else |err| {
                const fmt = "Error encountered while converting {s} to JavaScript value for property \"{s}\": {s}";
                throwException(iso, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.cfn;
}

fn createSetterThunk(comptime name: []const u8, comptime package: anytype) Thunk {
    const ThunkType = struct {
        fn cfn(iso: Isolate, info: CallInfo, pool: Pool) callconv(.C) void {
            const arg = callbacks.get_argument(info, 0);
            const T = @TypeOf(@field(package, name));
            if (convertTo(iso, pool, arg, T)) |value| {
                var ptr = &@field(package, name);
                ptr.* = value;
            } else |err| {
                const fmt = "Error encountered while converting JavaScript value to {s} for property \"{s}\": {s}";
                throwException(iso, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.cfn;
}

fn createFunction(comptime name: []const u8, comptime zig_fn: anytype) Function {
    const arg_count = @typeInfo(@TypeOf(zig_fn)).Fn.params.len;
    return .{
        .arg_count = arg_count,
        .thunk = createThunk(name, zig_fn),
    };
}

fn createVariable(comptime name: []const u8, comptime package: anytype) Variable {
    const writable = false;
    return .{
        .getter_thunk = createGetterThunk(name, package),
        .setter_thunk = if (writable) createSetterThunk(name, package) else null,
    };
}

fn reifySlice(comptime slice: anytype) ChildType(@TypeOf(slice)) {
    var array: ChildType(@TypeOf(slice)) = undefined;
    for (slice, 0..) |item, index| {
        array[index] = item;
    }
    return array;
}

fn createArray(comptime array: anytype) CArray(ChildType(@TypeOf(array))) {
    return .{ .items = &array, .count = array.len };
}

fn createString(comptime s: []const u8) [*:0]const u8 {
    return @ptrCast([*:0]const u8, s);
}

fn createEnumeration(comptime T: anytype) Enumeration {
    const fields = std.meta.fields(T);
    var entries: [fields.len]EnumerationItem = undefined;
    for (fields, 0..) |field, index| {
        entries[index] = .{
            .name = createString(field.name),
            .value = field.value,
        };
    }
    return createArray(entries);
}

fn createEntryTable(comptime package: anytype) EntryTable {
    const decls = @typeInfo(package).Struct.decls;
    var entries: [decls.len]Entry = undefined;
    var index = 0;
    for (decls) |decl| {
        if (decl.is_pub) {
            const field = @field(package, decl.name);
            const content: ?EntryContent = switch (@typeInfo(@TypeOf(field))) {
                .NoReturn, .Pointer, .Opaque, .Frame, .AnyFrame => null,
                .Type => switch (@typeInfo(field)) {
                    .Enum => .{
                        .type = EntryType.enum_set,
                        .params = .{ .enumeration = createEnumeration(field) },
                    },
                    else => null,
                },
                .Fn => .{
                    .type = EntryType.function,
                    .params = .{ .function = createFunction(decl.name, field) },
                },
                else => .{
                    .type = EntryType.variable,
                    .params = .{ .variable = createVariable(decl.name, package) },
                },
            };
            if (content) |c| {
                entries[index] = .{
                    .name = createString(decl.name),
                    .content = c,
                };
                index += 1;
            }
        }
    }
    return createArray(reifySlice(entries[0..index]));
}

pub fn createModule(comptime package: anytype) Module {
    return .{
        .version = api_version,
        .callbacks = &callbacks,
        .entries = createEntryTable(package),
    };
}
