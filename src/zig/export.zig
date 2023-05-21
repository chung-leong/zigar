const std = @import("std");
pub const api_version = 1;

//-----------------------------------------------------------------------------
//  Errors that might occur during type conversion
//-----------------------------------------------------------------------------
const Error = error{
    TODO,
    UnsupportedConversion,
    IntegerOverflow,
    IntegerUnderflow,
    FloatUnderflow,
    FloatOverflow,
    IntegerUnsafe,
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
    _: Padding(18) = 0,
};
const FunctionAttributes = packed struct(c_int) {
    throwing: bool = false,
    allocating: bool = false,
    suspending: bool = false,
    referencing: bool = false,
    _: Padding(4) = 0,
};
const TypedArray = extern struct {
    bytes: [*]u8,
    len: usize,
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
const EntryType = enum(c_int) {
    unavailable = 0,
    function,
    variable,
    enumeration,
};
const Argument = extern struct {
    possible_types: ValueMask,
    class_name: ?[*]const u8,
};
const Function = extern struct {
    thunk: Thunk,
    attributes: FunctionAttributes,
    arguments: [*]const Argument,
    argument_count: usize,
    return_default_type: ValueMask,
    return_possible_types: ValueMask,
    return_class_name: ?[*]const u8,
};
const Variable = extern struct {
    getter_thunk: ?Thunk,
    setter_thunk: ?Thunk,
    default_type: ValueMask,
    possible_types: ValueMask,
    class_name: ?[*]const u8,
};
const EnumerationItem = extern struct {
    name: [*:0]const u8,
    value: i64,
};
const Enumeration = extern struct {
    items: [*]const EnumerationItem,
    count: usize,
    is_signed: bool,
    default_type: ValueMask,
    possible_types: ValueMask,
};
const EntryParams = extern union {
    function: *const Function,
    variable: *const Variable,
    enumeration: *const Enumeration,
};
const EntryContent = extern struct {
    type: EntryType,
    params: EntryParams,
};
const Entry = extern struct {
    name: [*:0]const u8,
    content: EntryContent,
};
const EntryTable = extern struct {
    entries: [*]const Entry,
    count: usize,
};
const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    table: EntryTable,
};

//-----------------------------------------------------------------------------
//  Function-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    get_argument_count: *const fn (call: Call) callconv(.C) usize,
    get_argument: *const fn (call: Call, index: usize) callconv(.C) Value,
    get_argument_type: *const fn (call: Call, index: usize) callconv(.C) ValueMask,
    get_return_type: *const fn (call: Call) callconv(.C) ValueMask,
    set_return_value: *const fn (call: Call, retval: ?Value) callconv(.C) void,

    allocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    reallocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    free_memory: *const fn (call: Call, dest: *TypedArray) callconv(.C) Result,

    is_null: *const fn (value: Value) callconv(.C) bool,
    is_value_type: *const fn (value: Value, mask: ValueMask) callconv(.C) bool,

    get_property: *const fn (call: Call, name: [*]const u8, value: Value, dest: *Value) callconv(.C) Result,
    set_property: *const fn (call: Call, name: [*]const u8, value: Value, dest: Value) callconv(.C) Result,

    get_array_length: *const fn (call: Call, value: Value, dest: *usize) callconv(.C) Result,
    get_array_item: *const fn (call: Call, index: usize, value: Value, dest: *Value) callconv(.C) Result,
    set_array_item: *const fn (call: Call, index: usize, value: Value, dest: Value) callconv(.C) Result,

    unwrap_bool: ?*const fn (call: Call, value: Value, dest: *bool) callconv(.C) Result,
    unwrap_int32: ?*const fn (call: Call, value: Value, dest: *i32) callconv(.C) Result,
    unwrap_int64: ?*const fn (call: Call, value: Value, dest: *i64) callconv(.C) Result,
    unwrap_bigint: ?*const fn (call: Call, value: Value, dest: *BigInt(u64)) callconv(.C) Result,
    unwrap_double: ?*const fn (call: Call, value: Value, dest: *f64) callconv(.C) Result,
    unwrap_string: ?*const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,
    unwrap_typed_array: ?*const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,

    wrap_bool: ?*const fn (call: Call, value: bool, dest: *Value) callconv(.C) Result,
    wrap_int32: ?*const fn (call: Call, value: i32, dest: *Value) callconv(.C) Result,
    wrap_int64: ?*const fn (call: Call, value: i64, dest: *Value) callconv(.C) Result,
    wrap_bigint: ?*const fn (call: Call, value: *const BigInt(u64), dest: *Value) callconv(.C) Result,
    wrap_double: ?*const fn (call: Call, value: f64, dest: *Value) callconv(.C) Result,
    wrap_string: ?*const fn (call: Call, value: *const TypedArray, dest: *Value) callconv(.C) Result,
    wrap_typed_array: ?*const fn (call: Call, value: *const TypedArray, dest: *Value) callconv(.C) Result,

    throw_exception: *const fn (call: Call, message: [*:0]const u8) void,
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

fn reifySlice(comptime slice: anytype) ChildType(@TypeOf(slice)) {
    var array: ChildType(@TypeOf(slice)) = undefined;
    for (slice, 0..) |item, index| {
        array[index] = item;
    }
    return array;
}

fn typeNameCapitalized(comptime T: type) []const u8 {
    const name = comptime @typeName(T);
    var result: [name.len]u8 = name;
    if (result[0] >= 0x61 and result[0] <= 0x7a) {
        result[0] -= 0x20;
    }
    return result;
}

fn checkWritability(comptime package: anytype, comptime name: []const u8) bool {
    return switch (@typeInfo(@TypeOf(@field(package, name)))) {
        .Bool, .Int, .Enum, .Float, .Array, .Pointer, .Struct, .Fn => check: {
            // see if we get a const pointer
            const PT = @TypeOf(&@field(package, name));
            break :check switch (comptime @typeInfo(PT)) {
                .Pointer => |pt| !pt.is_const,
                else => false,
            };
        },
        else => false,
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
        .Float => {
            can_be.number = true;
        },
        .Array => |ar| {
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
                can_be.arrayBuffer = isBinaryKnown(pt.child, out);
                can_be.string = isUnicode(pt.child);
                const arrayName = @typeName(pt.child) ++ "Array";
                if (@hasDecl(can_be, arrayName)) {
                    @field(can_be, arrayName) = can_be.arrayBuffer;
                }
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
            if (int.bits > 64) {
                prefer.bigInt = true;
            } else {
                prefer.number = true;
            }
        },
        .Float => {
            prefer.number = true;
        },
        .Array => |ar| {
            if (isUnicode(ar.child)) {
                prefer.string = true;
            } else if (isInt(ar.child) or isFloat(ar.child)) {
                prefer.arrayBuffer = true;
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
                if (isUnicode(pt.child)) {
                    prefer.string = true;
                } else if (isInt(pt.child) or isFloat(pt.child)) {
                    prefer.arrayBuffer = true;
                } else {
                    prefer.array = true;
                }
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
                        if (cb(call, double, &value) == .OK) {
                            return value;
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
            _ = ar;
            return .TODO;
        },
        .Pointer => |pt| {
            _ = pt;
            return .TODO;
        },
        else => {},
    }
    return Error.UnsupportedConversion;
}

fn throwException(call: Call, comptime fmt: []const u8, vars: anytype) void {
    var buffer: [1024]u8 = undefined;
    const message = std.fmt.bufPrint(buffer[0..1023], fmt, vars) catch fmt;
    buffer[message.len] = 0;
    callbacks.throw_exception(call, @ptrCast([*:0]const u8, message.ptr));
}

//-----------------------------------------------------------------------------
//  Thunk creation functions (compile-time)
//-----------------------------------------------------------------------------
fn createThunk(comptime package: anytype, comptime name: []const u8) Thunk {
    const function = @field(package, name);
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const ThunkType = struct {
        // we're passing the function name and argument count into getArgument() in order to allow the function
        // to be reused across different functions
        fn getArgument(call: Call, fname: []const u8, i_ptr: *usize, count: i32, comptime T: type) ?T {
            if (comptime T == std.mem.Allocator) {
                // TODO: provide allocator
                return null;
            } else {
                const index: usize = i_ptr.*;
                const arg = callbacks.get_argument(call, index);
                const mask = callbacks.get_argument_type(call, index);
                i_ptr.* = index + 1;
                if (unwrapValue(call, arg, mask, T)) |value| {
                    return value;
                } else |err| {
                    const arg_count = callbacks.get_argument_count(call);
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

        fn handleResult(call: Call, fname: []const u8, result: anytype) void {
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
                const mask = callbacks.get_return_type(call);
                if (wrapValue(call, result, mask)) |value| {
                    callbacks.set_return_value(call, value);
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
            inline for (fields, 0..) |field, j| {
                if (getArgument(call, name, &i, count, field.type)) |arg| {
                    args[j] = arg;
                } else {
                    // exception thrown in getArgument()
                    return;
                }
            }
            var result = @call(std.builtin.CallModifier.auto, function, args);
            handleResult(call, name, result);
        }
    };
    return ThunkType.invokeFunction;
}

fn createGetterThunk(comptime package: anytype, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn invokeFunction(call: Call) callconv(.C) void {
            const field = @field(package, name);
            const T = @TypeOf(field);
            const mask = callbacks.get_return_type(call);
            if (wrapValue(call, field, mask)) |v| {
                callbacks.set_return_value(call, v);
            } else |err| {
                const fmt = "Error encountered while converting {s} to JavaScript value for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.invokeFunction;
}

fn createSetterThunk(comptime package: anytype, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn invokeFunction(call: Call) callconv(.C) void {
            const arg = callbacks.get_argument(call, 0);
            const T = @TypeOf(@field(package, name));
            const mask = callbacks.get_argument_type(call, 0);
            if (unwrapValue(call, arg, mask, T)) |value| {
                var ptr = &@field(package, name);
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

//-----------------------------------------------------------------------------
//  Functions that create the module struct (compile-time)
//-----------------------------------------------------------------------------
fn createFunction(comptime package: anytype, comptime name: []const u8) Function {
    const function = @field(package, name);
    const params = @typeInfo(@TypeOf(function)).Fn.params;
    var arguments: [params.len]Argument = undefined;
    var index = 0;
    for (params) |param| {
        const T = param.type orelse noreturn;
        if (T == std.mem.Allocator) {
            continue;
        }
        arguments[index] = .{
            .class_name = null,
            .possible_types = getPossibleTypes(T, false),
        };
        index += 1;
    }
    const arg_array = reifySlice(arguments[0..index]);

    const info = @typeInfo(@TypeOf(function)).Fn;
    // TODO: remove orelse clause when return_type is no longer optional
    const RT = BaseType(info.return_type orelse noreturn);
    var attributes: FunctionAttributes = .{};
    if (isErrorUnion(info.return_type orelse noreturn)) {
        attributes.throwing = true;
    }
    return .{
        .thunk = createThunk(package, name),
        .attributes = attributes,
        .arguments = &arg_array,
        .argument_count = arg_array.len,
        .return_class_name = null,
        .return_default_type = getReturnType(RT),
        .return_possible_types = getPossibleTypes(RT, true),
    };
}

fn createVariable(comptime package: anytype, comptime name: []const u8) Variable {
    const writable = checkWritability(package, name);
    const T = @TypeOf(@field(package, name));
    return .{
        .getter_thunk = createGetterThunk(package, name),
        .setter_thunk = if (writable) createSetterThunk(package, name) else null,
        .class_name = "hello",
        .default_type = getReturnType(T),
        .possible_types = getPossibleTypes(T, true),
    };
}

fn createString(comptime s: []const u8) [*:0]const u8 {
    return @ptrCast([*:0]const u8, s);
}

fn createEnumeration(comptime package: anytype, comptime name: []const u8) Enumeration {
    const T = @field(package, name);
    const fields = std.meta.fields(T);
    var entries: [fields.len]EnumerationItem = undefined;
    var is_signed = false;
    var default_type: ValueMask = .{ .number = true };
    var possible_types: ValueMask = .{ .number = true, .bigInt = true };
    for (fields, 0..) |field, index| {
        entries[index] = .{
            .name = createString(field.name),
            .value = field.value,
        };
        if (field.value < 0) {
            is_signed = true;
        }
    }
    return .{
        .items = &entries,
        .count = entries.len,
        .is_signed = is_signed,
        .default_type = default_type,
        .possible_types = possible_types,
    };
}

fn createEntryTable(comptime package: anytype) EntryTable {
    const decls = @typeInfo(package).Struct.decls;
    var entries: [decls.len]Entry = undefined;
    var index = 0;
    for (decls) |decl| {
        if (decl.is_pub) {
            const name = decl.name;
            const field = @field(package, name);
            const FT = @TypeOf(field);
            const content: ?EntryContent = switch (@typeInfo(FT)) {
                .NoReturn,
                .Pointer,
                .Opaque,
                .Frame,
                .AnyFrame,
                => null,
                .Type => switch (@typeInfo(field)) {
                    .Enum => .{
                        .type = .enumeration,
                        .params = .{ .enumeration = &createEnumeration(package, name) },
                    },
                    else => null,
                },
                .Fn => .{
                    .type = .function,
                    .params = .{ .function = &createFunction(package, name) },
                },
                else => .{
                    .type = .variable,
                    .params = .{ .variable = &createVariable(package, name) },
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
    const array = reifySlice(entries[0..index]);
    return .{
        .entries = &array,
        .count = array.len,
    };
}

pub fn createModule(comptime package: anytype) Module {
    return .{
        .version = api_version,
        .callbacks = &callbacks,
        .table = createEntryTable(package),
    };
}
