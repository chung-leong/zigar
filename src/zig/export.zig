const std = @import("std");
pub const api_version = 1;

//-----------------------------------------------------------------------------
//  Function for generating unique id for structs
//-----------------------------------------------------------------------------
fn getTypeInfoSlot(comptime s: anytype) usize {
    return @ptrToInt(&@typeInfo(@TypeOf(s))) / @sizeOf(std.builtin.Type);
}

fn getSlotId(comptime s: anytype) usize {
    switch (@typeInfo(@TypeOf(s))) {
        .Struct => {
            const baseId = getTypeInfoSlot(.{});
            return getTypeInfoSlot(s) - baseId;
        },
        else => @compileError("Not a struct"),
    }
}

//-----------------------------------------------------------------------------
//  Errors that might occur
//-----------------------------------------------------------------------------
const Error = error{
    TODO,
    UnsupportedConversion,
    IntegerOverflow,
    IntegerUnderflow,
    FloatUnderflow,
    FloatOverflow,
    IntegerUnsafe,
    UnknownError,
};

//-----------------------------------------------------------------------------
//  Opaque pointers pointing to objects on C++ side
//-----------------------------------------------------------------------------
const Call = *opaque {};
const Value = *opaque {};

//-----------------------------------------------------------------------------
//  Enum and structs used by both Zig and C++ code
//  (need to keep these in sync with their C++ definitions)
//-----------------------------------------------------------------------------
const Result = enum(c_int) {
    OK,
    Failure,
};
const NumberType = enum(c_int) {
    Unknown,
    I8,
    U8,
    I16,
    U16,
    I32,
    U32,
    I64,
    U64,
    F32,
    F64,
};
fn Padding(comptime used: comptime_int) type {
    return @Type(.{
        .Int = .{ .signedness = .unsigned, .bits = @bitSizeOf(c_int) - used },
    });
}
const ValueMask = packed struct(c_int) {
    empty: bool = false,
    boolean: bool = false,
    number: bool = false,
    bigInt: bool = false,
    string: bool = false,
    array: bool = false,
    object: bool = false,
    function: bool = false,
    arrayBuffer: bool = false,
    i8Array: bool = false,
    u8Array: bool = false,
    i16Array: bool = false,
    u16Array: bool = false,
    i32Array: bool = false,
    u32Array: bool = false,
    i64Array: bool = false,
    u64Array: bool = false,
    f32Array: bool = false,
    f64Array: bool = false,
    _: Padding(19) = 0,
};
const TypedArray = extern struct {
    bytes: [*]u8,
    byte_size: usize,
    element_type: NumberType,
};
const BigIntFlags = packed struct(c_int) {
    negative: bool = false,
    overflow: bool = false,
    _: Padding(2) = 0,
};
fn BigInt(comptime T: type) type {
    // use U64 if it's smaller than that
    const BT = if (@bitSizeOf(T) > 64) T else u64;
    const S = packed struct {
        flags: BigIntFlags,
        word_count: c_int,
        int: BT,
    };
    return S;
}

//-----------------------------------------------------------------------------
//  Data types that appear in the exported module struct
//-----------------------------------------------------------------------------
const Thunk = *const fn (call: Call) callconv(.C) void;
const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    get_root: Thunk,
};

//-----------------------------------------------------------------------------
//  Function-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    get_argument_count: *const fn (call: Call, dest: *usize) callconv(.C) Result,
    get_argument: *const fn (call: Call, index: usize, dest: *Value) callconv(.C) Result,
    set_return_value: *const fn (call: Call, retval: ?Value) callconv(.C) Result,

    get_slot_data: *const fn (call: Call, slot_id: usize, dest: **anyopaque) callconv(.C) Result,
    get_slot_object: *const fn (call: Call, slot_id: usize, dest: *Value) callconv(.C) Result,
    set_slot_data: *const fn (call: Call, slot_id: usize, data: *anyopaque, byte_size: usize) callconv(.C) Result,
    set_slot_object: *const fn (call: Call, slot_id: usize, object: Value) callconv(.C) Result,

    create_string: *const fn (call: Call, string: ?[*]const u8, dest: *Value) callconv(.C) Result,
    create_namespace: *const fn (call: Call, dest: *Value) callconv(.C) Result,
    create_function: *const fn (call: Call, name: Value, len: usize, thunk: Thunk, dest: *Value) callconv(.C) Result,
    create_constructor: *const fn (call: Call, name: Value, len: usize, thunk: Thunk, dest: *Value) callconv(.C) Result,
    create_object: *const fn (call: Call, class: Value, dest: *Value) callconv(.C) Result,

    get_property: *const fn (call: Call, container: Value, name: Value, dest: *Value) callconv(.C) Result,
    set_property: *const fn (call: Call, container: Value, name: Value, container: Value) callconv(.C) Result,
    set_accessors: *const fn (call: Call, container: Value, name: Value, getter: ?Thunk, setter: ?Thunk) callconv(.C) Result,

    get_array_length: *const fn (call: Call, value: Value, dest: *usize) callconv(.C) Result,
    get_array_item: *const fn (call: Call, index: usize, value: Value, dest: *Value) callconv(.C) Result,
    set_array_item: *const fn (call: Call, index: usize, value: Value, dest: Value) callconv(.C) Result,

    allocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    reallocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    free_memory: *const fn (call: Call, dest: *TypedArray) callconv(.C) Result,

    unwrap_bool: ?*const fn (call: Call, value: Value, dest: *bool) callconv(.C) Result,
    unwrap_int32: ?*const fn (call: Call, value: Value, dest: *i32) callconv(.C) Result,
    unwrap_int64: ?*const fn (call: Call, value: Value, dest: *i64) callconv(.C) Result,
    unwrap_bigint: ?*const fn (call: Call, value: Value, dest: *BigInt(u64)) callconv(.C) Result,
    unwrap_double: ?*const fn (call: Call, value: Value, dest: *f64) callconv(.C) Result,
    unwrap_string: ?*const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,
    unwrap_typed_array: ?*const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,

    is_value_type: *const fn (value: Value, mask: ValueMask, dest: *bool) callconv(.C) Result,

    wrap_bool: ?*const fn (call: Call, value: bool, dest: *Value) callconv(.C) Result,
    wrap_int32: ?*const fn (call: Call, value: i32, dest: *Value) callconv(.C) Result,
    wrap_int64: ?*const fn (call: Call, value: i64, dest: *Value) callconv(.C) Result,
    wrap_bigint: ?*const fn (call: Call, value: *const BigInt(u64), dest: *Value) callconv(.C) Result,
    wrap_double: ?*const fn (call: Call, value: f64, dest: *Value) callconv(.C) Result,
    wrap_string: ?*const fn (call: Call, value: *const TypedArray, dest: *Value) callconv(.C) Result,
    wrap_typed_array: ?*const fn (call: Call, value: *const TypedArray, dest: *Value) callconv(.C) Result,

    throw_exception: *const fn (call: Call, message: [*:0]const u8) Result,
};
var callbacks: Callbacks = undefined;

//-----------------------------------------------------------------------------
//  Compile-time functions
//-----------------------------------------------------------------------------
fn isScalar(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float => true,
        else => false,
    };
}

fn isUnicode(comptime T: type) bool {
    return T == u8 or T == u16;
}

fn isStruct(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => true,
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
        .Pointer => |pt| pt.size == .Slice,
        else => false,
    };
}

fn isBinaryKnown(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float => isScalar(T),
        .Array => |ar| isBinaryKnown(ar.child),
        .Struct => |st| switch (st.layout) {
            .Extern => true,
            .Packed => if (st.backing_integer) true else false,
            else => false,
        },
        else => false,
    };
}

fn isBool(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Bool => true,
        else => false,
    };
}

fn isInt(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int, .ComptimeInt => true,
        else => false,
    };
}

fn isFloat(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Float, .ComptimeFloat => true,
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

fn checkWritability(comptime S: type, comptime name: []const u8) bool {
    return switch (@typeInfo(@TypeOf(@field(S, name)))) {
        .Bool, .Int, .Enum, .Float, .Array, .Pointer, .Struct, .Fn => check: {
            // see if we get a const pointer
            const PT = @TypeOf(&@field(S, name));
            break :check switch (comptime @typeInfo(PT)) {
                .Pointer => |pt| !pt.is_const,
                else => false,
            };
        },
        else => false,
    };
}

fn getArrayType(comptime T: type) NumberType {
    return switch (@typeInfo(T)) {
        .Array => |ar| return getArrayType(ar.child),
        .Int, .Float => switch (T) {
            i8 => .I8,
            u8 => .U8,
            i16 => .I16,
            u16 => .U16,
            i32 => .I32,
            u32 => .U32,
            i64 => .I64,
            u64 => .U64,
            f32 => .F32,
            f64 => .F64,
            else => .Unknown,
        },
        else => .Unknown,
    };
}

fn getTypeMask(comptime numType: NumberType) ValueMask {
    return switch (numType) {
        .I8 => .{ .i8Array = true },
        .U8 => .{ .u8Array = true },
        .I16 => .{ .i16Array = true },
        .U16 => .{ .u16Array = true },
        .I32 => .{ .i32Array = true },
        .U32 => .{ .u32Array = true },
        .I64 => .{ .i32Array = true },
        .U64 => .{ .u32Array = true },
        .F32 => .{ .f32Array = true },
        .F64 => .{ .f64Array = true },
        else => .{},
    };
}

fn getPossibleTypes(comptime T: type, comptime out: bool) ValueMask {
    var can_be: ValueMask = .{};
    switch (@typeInfo(T)) {
        .Bool => {
            can_be.boolean = true;
        },
        .Int, .Enum => {
            can_be.number = true;
            can_be.bigInt = true;
        },
        .ComptimeInt => {
            can_be = getPossibleTypes(i53, out);
        },
        .Float => {
            can_be.number = true;
        },
        .ComptimeFloat => {
            can_be = getPossibleTypes(f64, out);
        },
        .Array => |ar| {
            const array_type = getArrayType(T);
            can_be = getTypeMask(array_type);
            can_be.array = true;
            can_be.arrayBuffer = isBinaryKnown(T);
            can_be.string = isUnicode(ar.child);
        },
        .Struct => {
            can_be.object = true;
            can_be.arrayBuffer = isBinaryKnown(T);
        },
        .Pointer => |pt| {
            if (pt.size == .One) {
                can_be = getPossibleTypes(pt.child, out);
            } else if (pt.size == .Slice) {
                const AT = @Type(.{ .Array = .{ .child = pt.child, .len = 0 } });
                return getPossibleTypes(AT, out);
            }
        },
        else => {},
    }
    return can_be;
}

fn getReturnType(comptime T: type) ValueMask {
    var prefer: ValueMask = .{};
    switch (@typeInfo(T)) {
        .Bool => {
            prefer.boolean = true;
        },
        .Int => |int| {
            if (int.bits <= 53) {
                prefer.number = true;
            } else {
                prefer.bigInt = true;
            }
        },
        .ComptimeInt => {
            prefer = getReturnType(i53);
        },
        .Float => {
            prefer.number = true;
        },
        .ComptimeFloat => {
            prefer = getReturnType(f64);
        },
        .Array => |ar| {
            const array_type = getArrayType(T);
            if (isUnicode(ar.child)) {
                prefer.string = true;
            } else if (array_type != .Unknown) {
                prefer = getTypeMask(array_type);
            } else {
                prefer.array = true;
            }
        },
        .Struct => {
            prefer.object = true;
        },
        .Pointer => |pt| {
            if (pt.size == .One) {
                prefer = getReturnType(pt.child);
            } else if (pt.size == .Slice) {
                const AT = @Type(.{ .Array = .{ .child = pt.child, .len = 0 } });
                return getReturnType(AT);
            }
        },
        else => {},
    }
    return prefer;
}

//-----------------------------------------------------------------------------
//  Run-time helper functions
//-----------------------------------------------------------------------------
fn castInt(comptime T: type, value: anytype) !T {
    if (@TypeOf(value) != T) {
        if (value < std.math.minInt(T)) {
            return Error.IntegerUnderflow;
        } else if (value > std.math.maxInt(T)) {
            return Error.IntegerOverflow;
        }
        return @intCast(T, value);
    } else {
        return value;
    }
}

fn castFloat(comptime T: type, value: anytype) !T {
    if (@TypeOf(value) != T) {
        const max = @field(std.math, @typeName(T) ++ "_max");
        const min = @field(std.math, @typeName(T) ++ "_min");
        if (value < min) {
            return Error.FloatUnderflow;
        } else if (value > max) {
            return Error.FloatOverflow;
        }
        return @floatCast(T, value);
    } else {
        return value;
    }
}

fn matchType(mask: ValueMask, types: ValueMask) bool {
    inline for (std.meta.fields(ValueMask)) |field| {
        if (field.type == bool) {
            const bit1 = @field(mask, field.name);
            const bit2 = @field(types, field.name);
            if (bit1 and bit2) {
                return true;
            }
        }
    }
    return false;
}

const arrayBufferMask: ValueMask = .{
    .arrayBuffer = true,
    .i8Array = true,
    .u8Array = true,
    .i16Array = true,
    .u16Array = true,
    .i32Array = true,
    .u32Array = true,
    .i64Array = true,
    .u64Array = true,
    .f32Array = true,
    .f64Array = true,
};

const maxSafeInteger = 9007199254740991.0;
const minSafeInteger = -9007199254740991.0;

fn unwrapValue(call: Call, value: Value, mask: ValueMask, comptime T: type) !T {
    switch (@typeInfo(T)) {
        .Optional => |opt| {
            if (callbacks.is_null(call, value)) {
                return null;
            }
            return unwrapValue(call, value, opt.target);
        },
        .ErrorUnion => |eu| {
            return unwrapValue(call, value, eu.target);
        },
        .Bool => {
            if (mask.boolean) {
                if (callbacks.unwrap_bool) |cb| {
                    var result: bool = undefined;
                    if (cb(call, value, &result) == .OK) {
                        return result;
                    }
                }
            }
        },
        .Int => |int| {
            if (mask.number) {
                inline for (.{ i32, i64 }) |IT| {
                    if (@field(callbacks, "unwrap_int" ++ @typeName(IT)[1..])) |cb| {
                        var result: IT = undefined;
                        if (cb(call, value, &result) == .OK) {
                            return castInt(T, result);
                        }
                    }
                }
                if (callbacks.unwrap_double) |cb| {
                    var result: f64 = undefined;
                    if (cb(call, value, &result) == .OK) {
                        if (result > maxSafeInteger or result < minSafeInteger) {
                            return Error.IntegerUnsafe;
                        }
                        const integer = @floatToInt(i64, result);
                        return castInt(T, integer);
                    }
                }
            }
            if (mask.bigInt) {
                if (callbacks.unwrap_bigint) |cb| {
                    var result: BigInt(T) = undefined;
                    result.word_count = @sizeOf(@TypeOf(result.int)) / 8;
                    const ptr = @ptrCast(*BigInt(u64), &result);
                    if (cb(call, value, ptr) == .OK) {
                        if (result.flags.overflow) {
                            if (result.flags.negative) {
                                return Error.IntegerUnderflow;
                            } else {
                                return Error.IntegerOverflow;
                            }
                        }
                        if (int.signedness == .signed) {
                            if (result.flags.negative) {
                                // negating the value might require an extra bit that we don't have
                                if (std.math.negateCast(result.int)) |nv| {
                                    return castInt(T, nv);
                                } else |_| {
                                    return Error.IntegerUnderflow;
                                }
                            }
                            return castInt(T, result.int);
                        } else {
                            if (result.flags.negative) {
                                return Error.IntegerUnderflow;
                            }
                            return castInt(T, result.int);
                        }
                    }
                }
            }
        },
        .ComptimeInt => {
            return unwrapValue(call, value, mask, i64);
        },
        .Float => {
            if (mask.number) {
                if (callbacks.unwrap_double) |cb| {
                    var result: f64 = undefined;
                    if (cb(call, value, &result) == .OK) {
                        return castFloat(T, result);
                    }
                }
                if (unwrapValue(call, value, mask, i64)) |integer| {
                    const double = @intToFloat(f64, integer);
                    return castFloat(T, double);
                } else |err| {
                    return err;
                }
            }
        },
        .ComptimeFloat => {
            return unwrapValue(call, value, mask, f64);
        },
        .Array => |ar| {
            _ = ar;
            return Error.TODO;
        },
        .Pointer => |pt| {
            _ = pt;
            return Error.TODO;
        },
        else => {},
    }
    return Error.UnsupportedConversion;
}

fn wrapValue(call: Call, value: anytype, mask: ValueMask) !?Value {
    const T = @TypeOf(value);
    var result: Value = undefined;
    var err: ?Error = null;
    switch (@typeInfo(T)) {
        .Void => {
            return null;
        },
        .Optional => {
            if (value) |v| {
                return wrapValue(call, v, mask);
            } else {
                return null;
            }
        },
        .ErrorUnion => {
            @compileError("Error should be handled prior to calling createValue");
        },
        .Bool => {
            if (mask.boolean) {
                if (callbacks.wrap_bool) |cb| {
                    if (cb(call, value, &result) == .OK) {
                        return result;
                    }
                }
            }
        },
        .Int => {
            if (mask.number) {
                inline for (.{ i32, i64 }) |IT| {
                    if (@field(callbacks, "wrap_int" ++ @typeName(IT)[1..])) |cb| {
                        if (value < std.math.minInt(IT)) {
                            err = Error.IntegerUnderflow;
                        } else if (value > std.math.maxInt(IT)) {
                            err = Error.IntegerUnderflow;
                        } else {
                            const integer = @intCast(IT, value);
                            if (cb(call, integer, &result) == .OK) {
                                return result;
                            }
                        }
                    }
                }
                if (callbacks.wrap_double) |cb| {
                    if (minSafeInteger <= value and value <= maxSafeInteger) {
                        const double = @intToFloat(f64, value);
                        if (cb(call, double, &result) == .OK) {
                            return result;
                        }
                    }
                }
            }
            if (mask.bigInt) {
                if (callbacks.wrap_bigint) |cb| {
                    var bigInt: BigInt(T) = undefined;
                    bigInt.flags.negative = (std.math.sign(value) == -1);
                    bigInt.int = @intCast(@TypeOf(bigInt.int), if (value < 0) -value else value);
                    bigInt.word_count = @sizeOf(@TypeOf(bigInt.int)) / 8;
                    const ptr = @ptrCast(*const BigInt(u64), &bigInt);
                    if (cb(call, ptr, &result) == .OK) {
                        return result;
                    }
                }
            }
        },
        .ComptimeInt => {
            std.debug.print("ComptimeInt\n", .{});
            const IT = if (value < 0) i64 else u64;
            return wrapValue(call, @intCast(IT, value), mask);
        },
        .Float => {
            if (mask.number) {
                if (callbacks.wrap_double) |cb| {
                    if (value < std.math.f64_min) {
                        err = Error.FloatUnderflow;
                    } else if (value > std.math.f64_max) {
                        err = Error.FloatOverflow;
                    } else {
                        const double = @floatCast(f64, value);
                        if (cb(call, double, &result) == .OK) {
                            return result;
                        }
                    }
                }
            }
        },
        .ComptimeFloat => {
            const IT = f64;
            return wrapValue(call, @floatCast(IT, value), mask);
        },
        .Array => |ar| {
            if (matchType(mask, arrayBufferMask)) {
                if (callbacks.wrap_typed_array) |cb| {
                    const array: TypedArray = .{
                        .bytes = @constCast(@ptrCast([*]const u8, &value)),
                        .byte_size = @sizeOf(T),
                        .element_type = getArrayType(T),
                    };
                    if (cb(call, &array, &result) == .OK) {
                        return result;
                    }
                }
            }
            _ = ar;
            return Error.TODO;
        },
        .Pointer => |pt| {
            _ = pt;
            return Error.TODO;
        },
        else => {},
    }
    return Error.UnsupportedConversion;
}

fn throwException(call: Call, comptime fmt: []const u8, vars: anytype) void {
    var buffer: [1024]u8 = undefined;
    const message = std.fmt.bufPrint(buffer[0..1023], fmt, vars) catch fmt;
    buffer[message.len] = 0;
    _ = callbacks.throw_exception(call, @ptrCast([*:0]const u8, message.ptr));
}

//-----------------------------------------------------------------------------
//  Thunk creation functions (compile-time)
//-----------------------------------------------------------------------------
fn createThunk(comptime S: type, comptime name: []const u8) Thunk {
    const function = @field(S, name);
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const ThunkType = struct {
        // we're passing the function name and argument count into getArgument() in order to allow the function
        // to be reused across different functions
        fn getArgument(call: Call, fname: []const u8, i_ptr: *usize, count: i32, comptime T: type, mask: ValueMask) ?T {
            if (comptime T == std.mem.Allocator) {
                // TODO: provide allocator
                return null;
            } else {
                const index: usize = i_ptr.*;
                var arg: Value = undefined;
                _ = callbacks.get_argument(call, index, &arg);
                i_ptr.* = index + 1;
                if (unwrapValue(call, arg, mask, T)) |value| {
                    return value;
                } else |err| {
                    var arg_count: usize = undefined;
                    _ = callbacks.get_argument_count(call, &arg_count);
                    if (err == Error.UnsupportedConversion and arg_count < count) {
                        const fmt = "{s}() expects {d} argument(s), {d} given";
                        throwException(call, fmt, .{ fname, count, arg_count });
                    } else {
                        const fmt = "Error encountered while converting JavaScript value to {s} for argument {d} of {s}(): {s}";
                        throwException(call, fmt, .{ @typeName(T), index + 1, fname, @errorName(err) });
                    }
                    return null;
                }
            }
        }

        fn handleResult(call: Call, fname: []const u8, result: anytype, mask: ValueMask) void {
            if (comptime isErrorUnion(@TypeOf(result))) {
                if (result) |value| {
                    handleResult(call, fname, value);
                } else |err| {
                    throwException(call, "Error encountered in {s}(): {s}", .{ fname, @errorName(err) });
                }
            } else if (comptime isOptional(@TypeOf(result))) {
                if (result) |value| {
                    handleResult(call, fname, value);
                }
            } else {
                if (wrapValue(call, result, mask)) |value| {
                    _ = callbacks.set_return_value(call, value);
                } else |err| {
                    const T = BaseType(@TypeOf(result));
                    const fmt = "Error encountered while converting {s} to JavaScript value for return value of {s}(): {s}";
                    throwException(call, fmt, .{ @typeName(T), fname, @errorName(err) });
                }
            }
        }

        fn invokeFunction(call: Call) callconv(.C) void {
            var args: Args = undefined;
            const fields = std.meta.fields(Args);
            const count = fields.len;
            var i: usize = 0;
            const masks = getFunctionTypeMasks(function);
            inline for (fields, 0..) |field, j| {
                if (getArgument(call, name, &i, count, field.type, masks[i])) |arg| {
                    args[j] = arg;
                } else {
                    // exception thrown in getArgument()
                    return;
                }
            }
            var result = @call(std.builtin.CallModifier.auto, function, args);
            handleResult(call, name, result, masks[masks.len - 1]);
        }
    };
    return ThunkType.invokeFunction;
}

fn createGetterThunk(comptime S: type, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn invokeFunction(call: Call) callconv(.C) void {
            const field = @field(S, name);
            const T = @TypeOf(field);
            const mask = comptime getReturnType(T);
            if (wrapValue(call, field, mask)) |v| {
                _ = callbacks.set_return_value(call, v);
            } else |err| {
                const fmt = "Error encountered while converting {s} to JavaScript value for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.invokeFunction;
}

fn createSetterThunk(comptime S: type, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn invokeFunction(call: Call) callconv(.C) void {
            var arg: Value = undefined;
            _ = callbacks.get_argument(call, 0, &arg);
            const T = @TypeOf(@field(S, name));
            const mask = getPossibleTypes(T, false);
            if (unwrapValue(call, arg, mask, T)) |value| {
                var ptr = &@field(S, name);
                ptr.* = value;
            } else |err| {
                const fmt = "Error encountered while converting JavaScript value to {s} for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.invokeFunction;
}

pub fn createRootThunk(comptime S: type) Thunk {
    const ThunkType = struct {
        fn invokeFunction(call: Call) callconv(.C) void {
            if (exportStructure(call, S)) |ns| {
                _ = callbacks.set_return_value(call, ns);
            } else |err| {
                const fmt = "Error encountered while exporting module \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(S), @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.invokeFunction;
}

//-----------------------------------------------------------------------------
//  Functions that create the module struct (compile-time)
//-----------------------------------------------------------------------------
fn createString(call: Call, string: []const u8) Value {
    var value: Value = undefined;
    const c_string = @ptrCast([*:0]const u8, string);
    _ = callbacks.create_string(call, c_string, &value);
    return value;
}

fn getFunctionTypeMasks(comptime function: anytype) []ValueMask {
    const info = @typeInfo(@TypeOf(function)).Fn;
    var types: [info.params.len + 1]ValueMask = undefined;
    // TODO: remove orelse clause when return_type is no longer optional
    const RT = BaseType(info.return_type orelse noreturn);
    var index: usize = 0;
    inline for (info.params) |param| {
        const T = param.type orelse noreturn;
        if (T == std.mem.Allocator) {
            continue;
        }
        types[index] = getPossibleTypes(T, false);
        index += 1;
    }
    types[index] = getReturnType(RT);
    index += 1;
    return types[0..index];
}

fn attachFunction(call: Call, comptime S: type, comptime name: []const u8, container: Value) !void {
    const zig_func = @field(S, name);
    const masks = getFunctionTypeMasks(zig_func);
    // the last item is for the return value
    const arg_count = masks.len - 1;
    const thunk = createThunk(S, name);
    var function: Value = undefined;
    const key = createString(call, name);
    if (callbacks.create_function(call, key, arg_count, thunk, &function) != .OK) {
        return Error.UnknownError;
    }
    if (callbacks.set_property(call, container, key, function) != .OK) {
        return Error.UnknownError;
    }
}

fn attachStaticProperty(call: Call, comptime S: type, comptime name: []const u8, container: Value) !void {
    const writable = comptime checkWritability(S, name);
    const getter = createGetterThunk(S, name);
    const setter = if (writable) createSetterThunk(S, name) else null;
    const key = createString(call, name);
    if (callbacks.set_accessors(call, container, key, getter, setter) != .OK) {
        return Error.UnknownError;
    }
}

fn attachStructure(call: Call, comptime S: type, comptime name: []const u8, container: Value) !void {
    const T = @field(S, name);
    if (try exportStructure(call, T)) |value| {
        const key = createString(call, name);
        if (callbacks.set_property(call, container, key, value) != .OK) {
            return Error.UnknownError;
        }
    }
}

fn exportStructure(call: Call, comptime S: type) !?Value {
    const decls = switch (@typeInfo(S)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        //.Enum => |em| em.decls,
        else => return null,
    };
    const fields = switch (@typeInfo(S)) {
        .Struct => |st| st.fields,
        .Union => |un| un.fields,
        .Enum => |em| em.fields,
        else => return null,
    };
    const container = try switch (@typeInfo(S)) {
        .Struct, .Union => value: {
            // TODO: create a class if the object has methods or fields
            var value: Value = undefined;
            const rv = callbacks.create_namespace(call, &value);
            break :value if (rv == .OK) value else Error.UnknownError;
        },
        .Enum => value: {
            // TODO: create enum class
            var value: Value = undefined;
            const rv = callbacks.create_namespace(call, &value);
            break :value if (rv == .OK) value else Error.UnknownError;
        },
        else => return null,
    };

    inline for (decls) |decl| {
        if (decl.is_pub) {
            const name = decl.name;
            const field = @field(S, name);
            const FT = @TypeOf(field);
            switch (@typeInfo(FT)) {
                .NoReturn, .Pointer, .Opaque, .Frame, .AnyFrame => {},
                .Fn => try attachFunction(call, S, name, container),
                .Type => try attachStructure(call, S, name, container),
                else => try attachStaticProperty(call, S, name, container),
            }
        }
    }
    for (fields) |field| {
        // TODO
        _ = field;
    }
    return container;
}

pub fn createModule(comptime S: type) Module {
    return .{
        .version = api_version,
        .callbacks = &callbacks,
        .get_root = createRootThunk(S),
    };
}
