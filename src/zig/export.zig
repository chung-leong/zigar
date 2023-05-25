const std = @import("std");
pub const api_version = 1;

//-----------------------------------------------------------------------------
//  For generating unique id for structs
//-----------------------------------------------------------------------------
const slotCounter = blk: {
    comptime var next = 1;
    const counter = struct {
        // results of comptime functions are memoized
        // the same struct will yield the same number
        fn get(comptime S: anytype) comptime_int {
            _ = S;
            const slot = next;
            next += 1;
            return slot;
        }
    };
    break :blk counter;
};

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
    MissingThis,
};

//-----------------------------------------------------------------------------
//  Opaque pointers pointing to objects on C++ side
//-----------------------------------------------------------------------------
const Call = *opaque {};
const Value = *opaque {};
const Construct = *struct { content: Value };
const Namespace = Construct;
const Function = Construct;
const Class = Construct;
const Enumeration = Construct;
const AnyObject = *anyopaque;

//-----------------------------------------------------------------------------
//  Enum and structs used by both Zig and C++ code
//  (need to keep these in sync with their C++ definitions)
//-----------------------------------------------------------------------------
const Result = enum(c_int) {
    OK,
    Failure,
};
const NumberType = enum(c_int) {
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
const Factory = *const fn (call: Call, dest: *Namespace) callconv(.C) Result;
const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    factory: Factory,
};

//-----------------------------------------------------------------------------
//  Value-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    get_this: *const fn (call: Call, dest: *Value) callconv(.C) Result,
    get_argument_count: *const fn (call: Call, dest: *usize) callconv(.C) Result,
    get_argument: *const fn (call: Call, index: usize, dest: *Value) callconv(.C) Result,
    set_return_value: *const fn (call: Call, retval: ?Value) callconv(.C) Result,

    get_slot_data: *const fn (call: Call, slot_id: usize, dest: **anyopaque) callconv(.C) Result,
    get_slot_object: *const fn (call: Call, slot_id: usize, dest: *AnyObject) callconv(.C) Result,
    set_slot_data: *const fn (call: Call, slot_id: usize, data: *anyopaque, byte_size: usize) callconv(.C) Result,
    set_slot_object: *const fn (call: Call, slot_id: usize, object: AnyObject) callconv(.C) Result,

    create_namespace: *const fn (call: Call, dest: *Namespace) callconv(.C) Result,
    create_class: *const fn (call: Call, name: Value, thunk: Thunk, dest: *Class) callconv(.C) Result,
    create_function: *const fn (call: Call, name: Value, len: usize, thunk: Thunk, dest: *Function) callconv(.C) Result,
    create_enumeration: *const fn (call: Call, name: Value, thunk: Thunk, dest: *Enumeration) callconv(.C) Result,

    add_construct: *const fn (call: Call, container: Construct, name: Value, construct: Construct) callconv(.C) Result,
    add_accessors: *const fn (call: Call, container: Construct, name: Value, getter: ?Thunk, setter: ?Thunk) callconv(.C) Result,
    add_static_accessors: *const fn (call: Call, container: Construct, name: Value, getter: ?Thunk, setter: ?Thunk) callconv(.C) Result,
    add_enumeration_item: *const fn (call: Call, container: Enumeration, name: Value, value: Value, dest: *Value) callconv(.C) Result,

    create_object: *const fn (call: Call, class: Class, dest: *Value) callconv(.C) Result,
    create_array: *const fn (call: Call, len: usize, dest: *Value) callconv(.C) Result,
    create_string: *const fn (call: Call, string: ?[*]const u8, dest: *Value) callconv(.C) Result,

    get_property: *const fn (call: Call, container: Value, name: Value, dest: *Value) callconv(.C) Result,
    set_property: *const fn (call: Call, container: Value, name: Value, value: Value) callconv(.C) Result,

    get_array_length: *const fn (call: Call, value: Value, dest: *usize) callconv(.C) Result,
    get_array_item: *const fn (call: Call, index: usize, value: Value, dest: *Value) callconv(.C) Result,
    set_array_item: *const fn (call: Call, index: usize, value: Value) callconv(.C) Result,

    allocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    reallocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    free_memory: *const fn (call: Call, dest: *TypedArray) callconv(.C) Result,

    is_value_type: *const fn (value: Value, mask: ValueMask, dest: *bool) callconv(.C) Result,

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

fn FitInt(comptime value: comptime_int) type {
    const signedness = if (value < 0) .signed else .unsigned;
    var bits = 32;
    while (true) : (bits += 32) {
        const IT = @Type(.{
            .Int = .{ .bits = bits, .signedness = signedness },
        });
        if (std.math.minInt(IT) <= value and value <= std.math.maxInt(IT)) {
            return IT;
        }
    }
}

fn FitEnum(comptime T: type) type {
    const fields = @typeInfo(T).Enum.fields;
    const signedness = sign: {
        for (fields) |field| {
            if (field.value < 0) {
                break :sign .signed;
            }
        }
        break :sign .unsigned;
    };
    var bits = 32;
    while (true) : (bits += 32) {
        const IT = @Type(.{
            .Int = .{ .bits = bits, .signedness = signedness },
        });
        var all_fit = true;
        for (fields) |field| {
            const value = field.value;
            if (!(std.math.minInt(IT) <= value and value <= std.math.maxInt(IT))) {
                all_fit = false;
                break;
            }
        }
        if (all_fit) {
            return IT;
        }
    }
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

fn getNumberType(comptime T: type) NumberType {
    return switch (T) {
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
        else => @compileError("Not a numeric type"),
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
        if (value < std.math.floatMin(T)) {
            return Error.FloatUnderflow;
        } else if (value > std.math.floatMax(T)) {
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

//-----------------------------------------------------------------------------
//  Run-time helper functions that invoke host-provided methods
//-----------------------------------------------------------------------------
fn getThis(call: Call) ?Value {
    var this: Value = undefined;
    if (callbacks.get_this(call, &this) != .OK) {
        return null;
    }
    return this;
}

fn getArgument(call: Call, index: usize) Value {
    var arg: Value = undefined;
    _ = callbacks.get_argument(call, index, &arg);
    return arg;
}

fn getArgumentCount(call: Call) usize {
    var count: usize = undefined;
    return if (callbacks.get_argument_count(call, &count) == .OK) count else 0;
}

fn setReturnValue(call: Call, value: ?Value) void {
    _ = callbacks.set_return_value(call, value orelse return);
}

fn createString(call: Call, string: []const u8) Value {
    const c_string = @ptrCast([*:0]const u8, string);
    var value: Value = undefined;
    _ = callbacks.create_string(call, c_string, &value);
    return value;
}

fn createFunction(call: Call, name: Value, arg_count: usize, thunk: Thunk) !Function {
    var function: Function = undefined;
    if (callbacks.create_function(call, name, arg_count, thunk, &function) != .OK) {
        return Error.UnknownError;
    }
    return function;
}

fn createNamespace(call: Call) !Namespace {
    var container: Namespace = undefined;
    if (callbacks.create_namespace(call, &container) != .OK) {
        return Error.UnknownError;
    }
    return container;
}

fn createEnumeration(call: Call, name: Value, thunk: Thunk) !Enumeration {
    var container: Enumeration = undefined;
    if (callbacks.create_enumeration(call, name, thunk, &container) != .OK) {
        return Error.UnknownError;
    }
    return container;
}

fn createClass(call: Call, name: Value, thunk: Thunk) !Class {
    var container: Class = undefined;
    if (callbacks.create_class(call, name, thunk, &container) != .OK) {
        return Error.UnknownError;
    }
    return container;
}

fn addConstruct(call: Call, container: Construct, name: Value, construct: Construct) !void {
    if (callbacks.add_construct(call, container, name, construct) != .OK) {
        return Error.UnknownError;
    }
}

fn addAccessors(call: Call, container: Class, name: Value, getter: ?Thunk, setter: ?Thunk) !void {
    if (callbacks.add_accessors(call, container, name, getter, setter) != .OK) {
        return Error.UnknownError;
    }
}

fn addStaticAccessors(call: Call, container: Class, name: Value, getter: ?Thunk, setter: ?Thunk) !void {
    if (callbacks.add_static_accessors(call, container, name, getter, setter) != .OK) {
        return Error.UnknownError;
    }
}

fn addEnumerationItem(call: Call, container: Enumeration, name: Value, value: Value) !Value {
    var item: Value = undefined;
    if (callbacks.add_enumeration_item(call, container, name, value, &item) != .OK) {
        return Error.UnknownError;
    }
    return item;
}

fn setProperty(call: Call, container: Value, name: Value, value: Value) !void {
    if (callbacks.set_property(call, container, name, value) != .OK) {
        return Error.UnknownError;
    }
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
const maxSafeInteger = 9007199254740991;
const minSafeInteger = -9007199254740991;

fn unwrapValue(call: Call, value: Value, comptime T: type) !T {
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
            if (callbacks.unwrap_bool) |cb| {
                var result: bool = undefined;
                if (cb(call, value, &result) == .OK) {
                    return result;
                }
            }
        },
        .Int => |int| {
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
        },
        .Float => {
            inline for (.{ i32, i64 }) |IT| {
                if (@field(callbacks, "unwrap_int" ++ @typeName(IT)[1..])) |cb| {
                    var result: IT = undefined;
                    if (cb(call, value, &result) == .OK) {
                        return castFloat(T, result);
                    }
                }
            }
            if (callbacks.unwrap_double) |cb| {
                var result: f64 = undefined;
                if (cb(call, value, &result) == .OK) {
                    return castFloat(T, result);
                }
            }
            if (callbacks.unwrap_bigint) |cb| {
                var result: BigInt(u64) = .{ .word_count = 1 };
                if (cb(call, value, &result) == .OK) {
                    if (!result.flags.overflow) {
                        return castFloat(T, result.int);
                    }
                    // try again using the word_count returned by the host
                    const IT = @Type(.{ .Int = .{
                        .bits = result.word_count * 64,
                        .signed = if (result.flags.negative) .signed else .unsigned,
                    } });
                    var result2: BigInt(IT) = undefined;
                    result2.word_count = @sizeOf(@TypeOf(result.int)) / 8;
                    const ptr = @ptrCast(*BigInt(u64), &result2);
                    if (cb(call, value, ptr) == .OK) {
                        if (result2.flags.overflow) {
                            // shouldn't happen
                            if (result.flags.negative) {
                                return Error.FloatUnderflow;
                            } else {
                                return Error.FloatOverflow;
                            }
                        }
                        return castFloat(T, result.int);
                    }
                }
            }
        },
        .ComptimeInt => {
            // exporting functions with comptime argument is weird, but allow it
            return unwrapValue(call, value, i64);
        },
        .ComptimeFloat => {
            return unwrapValue(call, value, f64);
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

fn wrapValue(call: Call, value: anytype) !?Value {
    const T = @TypeOf(value);
    var result: Value = undefined;
    var err: ?Error = null;
    switch (@typeInfo(T)) {
        .Void => {
            return null;
        },
        .Optional => {
            if (value) |v| {
                return wrapValue(call, v);
            } else {
                return null;
            }
        },
        .ErrorUnion => {
            @compileError("Error should be handled prior to calling wrapValue");
        },
        .Bool => {
            if (callbacks.wrap_bool) |cb| {
                if (cb(call, value, &result) == .OK) {
                    return result;
                }
            }
        },
        .Int => |int| {
            if (int.bits <= 53) {
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
            } else {
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
        .Float => {
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
        },
        .ComptimeInt => {
            // determine the type based on the actual value
            const IT = FitInt(value);
            return wrapValue(call, @intCast(IT, value));
        },
        .ComptimeFloat => {
            return wrapValue(call, @floatCast(f64, value));
        },
        .Array => |ar| {
            // return TypedArray when elements are ints or floats
            if (callbacks.wrap_typed_array) |cb| {
                if (isInt(ar.child) or isFloat(ar.child)) {
                    const array: TypedArray = .{
                        .bytes = @constCast(@ptrCast([*]const u8, &value)),
                        .byte_size = @sizeOf(T),
                        .element_type = getNumberType(ar.child),
                    };
                    if (cb(call, &array, &result) == .OK) {
                        return result;
                    }
                }
            }
            // use regular array otherwise
            var array: Value = undefined;
            if (callbacks.create_array(call, value.len, &array) == .OK) {
                for (value, 0..) |element, index| {
                    if (try wrapValue(call, element)) |element_value| {
                        if (callbacks.set_array_item(call, index, element_value) != .OK) {
                            return Error.UnknownError;
                        }
                    }
                }
            }
            return array;
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

fn setSlotObject(call: Call, object: AnyObject, comptime S: anytype) !void {
    const slot = slotCounter.get(S);
    if (callbacks.set_slot_object(call, slot, object) != .OK) {
        return Error.UnknownError;
    }
}

fn getSlotObject(call: Call, comptime S: anytype) ?AnyObject {
    const slot = slotCounter.get(S);
    var value: AnyObject = undefined;
    if (callbacks.get_slot_object(call, slot, &value) != .OK) {
        return null;
    }
    return value;
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
        fn unwrapArgument(call: Call, fname: []const u8, i_ptr: *usize, count: i32, comptime T: type) ?T {
            if (comptime T == std.mem.Allocator) {
                // TODO: provide allocator
                return null;
            } else {
                const index: usize = i_ptr.*;
                const arg = getArgument(call, index);
                i_ptr.* = index + 1;
                return unwrapValue(call, arg, T) catch |err| {
                    const arg_count = getArgumentCount(call);
                    if (err == Error.UnsupportedConversion and arg_count < count) {
                        const fmt = "{s}() expects {d} argument(s), {d} given";
                        throwException(call, fmt, .{ fname, count, arg_count });
                    } else {
                        const fmt = "Error encountered while converting JavaScript value to {s} for argument {d} of {s}(): {s}";
                        throwException(call, fmt, .{ @typeName(T), index + 1, fname, @errorName(err) });
                    }
                    return null;
                };
            }
        }

        fn wrapResult(call: Call, fname: []const u8, result: anytype) void {
            if (comptime isErrorUnion(@TypeOf(result))) {
                if (result) |value| {
                    wrapResult(call, fname, value);
                } else |err| {
                    throwException(call, "Error encountered in {s}(): {s}", .{ fname, @errorName(err) });
                }
            } else if (comptime isOptional(@TypeOf(result))) {
                if (result) |value| {
                    wrapResult(call, fname, value);
                }
            } else {
                const value = wrapValue(call, result) catch |err| {
                    const T = BaseType(@TypeOf(result));
                    const fmt = "Error encountered while converting {s} to JavaScript value for return value of {s}(): {s}";
                    throwException(call, fmt, .{ @typeName(T), fname, @errorName(err) });
                    return;
                };
                setReturnValue(call, value);
            }
        }

        fn invokeFunction(call: Call) callconv(.C) void {
            var args: Args = undefined;
            const fields = std.meta.fields(Args);
            const count = fields.len;
            var i: usize = 0;
            inline for (fields, 0..) |field, j| {
                if (unwrapArgument(call, name, &i, count, field.type)) |arg| {
                    args[j] = arg;
                } else {
                    // exception thrown in getArgument()
                    return;
                }
            }
            var result = @call(std.builtin.CallModifier.auto, function, args);
            wrapResult(call, name, result);
        }
    };
    return ThunkType.invokeFunction;
}

fn createStaticGetterThunk(comptime S: type, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn returnValue(call: Call) callconv(.C) void {
            const field = @field(S, name);
            const T = @TypeOf(field);
            const value = wrapValue(call, field) catch |err| {
                const fmt = "Error encountered while converting {s} to JavaScript value for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            };
            setReturnValue(call, value);
        }
    };
    return ThunkType.returnValue;
}

fn createGetterThunk(comptime S: type, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn returnValue(call: Call) callconv(.C) void {
            const this = getThis(call) orelse {
                return;
            };
            const self = unwrapValue(call, this, S) catch |err| {
                const fmt = "Invoking getter function on the wrong instance: {s}";
                throwException(call, fmt, .{@errorName(err)});
                return;
            };
            const field = @field(self, name);
            const T = @TypeOf(field);
            const value = wrapValue(call, field) catch |err| {
                const fmt = "Error encountered while converting {s} to JavaScript value for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            };
            setReturnValue(call, value);
        }
    };
    return ThunkType.returnValue;
}

fn createStaticSetterThunk(comptime S: type, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn assignValue(call: Call) callconv(.C) void {
            const arg = getArgument(call, 0);
            const T = @TypeOf(@field(S, name));
            const value = unwrapValue(call, arg, T) catch |err| {
                const fmt = "Error encountered while converting JavaScript value to {s} for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            };
            var ptr = &@field(S, name);
            ptr.* = value;
        }
    };
    return ThunkType.assignValue;
}

fn createSetterThunk(comptime S: type, comptime name: []const u8) Thunk {
    const ThunkType = struct {
        fn assignValue(call: Call) callconv(.C) void {
            const this = getThis(call) orelse {
                return;
            };
            const self = unwrapValue(call, this, S) catch |err| {
                const fmt = "Invoking setter function on the wrong instance: {s}";
                throwException(call, fmt, .{@errorName(err)});
                return;
            };
            const arg = getArgument(call, 0);
            const T = @TypeOf(@field(self, name));
            const value = unwrapValue(call, arg, T) catch |err| {
                const fmt = "Error encountered while converting JavaScript value to {s} for property \"{s}\": {s}";
                throwException(call, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            };
            var ptr = &@field(self, name);
            ptr.* = value;
        }
    };
    return ThunkType.assignValue;
}

fn createConstructorThunk(comptime T: type) Thunk {
    _ = T;
    const ThunkType = struct {
        fn constructInstance(call: Call) callconv(.C) void {
            if (getThis(call)) |this| {
                _ = this;
            }
        }
    };
    return ThunkType.constructInstance;
}

fn createEnumerationThunk(comptime T: type) Thunk {
    const ThunkType = struct {
        fn obtainItem(call: Call) callconv(.C) void {
            if (getArgumentCount(call) != 1) {
                return;
            }
            const IT = FitEnum(T);
            const arg = getArgument(call, 0);
            const value = unwrapValue(call, arg, IT) catch return;
            inline for (@typeInfo(T).Enum.fields) |field| {
                if (field.value == value) {
                    const item = getSlotObject(call, .{ .Enum = T, .Value = field.value });
                    setReturnValue(call, @ptrCast(Value, item));
                    return;
                }
            }
        }
    };
    return ThunkType.obtainItem;
}

//-----------------------------------------------------------------------------
//  Values that get called mainly when a module load
//-----------------------------------------------------------------------------
fn attachValue(call: Call, container: Construct, comptime S: type, comptime name: []const u8) !void {
    const zig_func = @field(S, name);
    const info = @typeInfo(@TypeOf(zig_func)).Fn;
    const arg_count = count: {
        comptime var n = 0;
        inline for (info.params, 0..) |param, index| {
            const T = param.type orelse void;
            if (T == std.mem.Allocator) {
                continue;
            } else if (T == @This() and index == 0) {
                continue;
            }
            n += 1;
        }
        break :count n;
    };
    const thunk = createThunk(S, name);
    const key = createString(call, name);
    const function: Function = try createFunction(call, key, arg_count, thunk);
    return addConstruct(call, container, key, function);
}

fn attachStaticProperty(call: Call, container: Construct, comptime S: type, comptime name: []const u8) !void {
    const writable = comptime checkWritability(S, name);
    const getter = createStaticGetterThunk(S, name);
    const setter = if (writable) createStaticSetterThunk(S, name) else null;
    const key = createString(call, name);
    try addStaticAccessors(call, container, key, getter, setter);
}

fn attachProperty(call: Call, container: Construct, comptime S: type, comptime name: []const u8) !void {
    const getter = createGetterThunk(S, name);
    const setter = createSetterThunk(S, name);
    const key = createString(call, name);
    try addStaticAccessors(call, container, key, getter, setter);
}

fn attachType(call: Call, container: Construct, comptime S: type, comptime name: []const u8) !void {
    const T = @field(S, name);
    const result: ?Construct = try switch (@typeInfo(T)) {
        .Struct => exportStructure(call, T, name),
        .Union => exportUnion(call, T, name),
        .Enum => exportEnumeration(call, T, name),
        else => return,
    };
    if (result) |value| {
        const key = createString(call, name);
        try addConstruct(call, container, key, value);
    }
}

fn attachDeclarations(call: Call, container: Construct, comptime T: type, comptime decls: anytype) !void {
    inline for (decls) |decl| {
        if (decl.is_pub) {
            const field = @field(T, decl.name);
            const FT = @TypeOf(field);
            switch (@typeInfo(FT)) {
                .NoReturn, .Pointer, .Opaque, .Frame, .AnyFrame => {},
                .Fn => try attachValue(call, container, T, decl.name),
                .Type => try attachType(call, container, T, decl.name),
                else => try attachStaticProperty(call, container, T, decl.name),
            }
        }
    }
}

fn attachStructureFields(call: Call, container: Class, comptime T: type, comptime fields: anytype) !void {
    inline for (fields) |field| {
        if (!field.is_comptime) {
            try attachProperty(call, container, T, field.name);
        }
    }
}

fn attachUnionFields(call: Call, container: Class, comptime T: type, comptime fields: anytype) !void {
    inline for (fields) |field| {
        if (!field.is_comptime) {
            try attachProperty(call, container, T, field.name);
        }
    }
}

fn attachEnumerationFields(call: Call, container: Enumeration, comptime T: type, comptime fields: anytype) !void {
    const ET = FitEnum(T);
    inline for (fields) |field| {
        const name = createString(call, field.name);
        const value = try wrapValue(call, @intCast(ET, field.value)) orelse return Error.UnknownError;
        const item = try addEnumerationItem(call, container, name, value);
        // save item into slot
        try setSlotObject(call, item, .{ .Enum = T, .Value = field.value });
    }
}

fn exportStructure(call: Call, comptime T: type, comptime name: []const u8) !Class {
    const info = @typeInfo(T).Struct;
    const container = try if (info.fields.len == 0) ns: {
        break :ns createNamespace(call);
    } else cls: {
        const class_name = createString(call, name);
        const thunk = createConstructorThunk(T);
        break :cls createClass(call, class_name, thunk);
    };
    try attachDeclarations(call, container, T, info.decls);
    try attachStructureFields(call, container, T, info.fields);
    if (info.fields.len > 0) {
        // associate struct with new class
        try setSlotObject(call, container, .{ .Struct = T });
    }
    return container;
}

fn exportUnion(call: Call, comptime T: type, comptime name: []const u8) !Class {
    const info = @typeInfo(T).Union;
    const container = if (info.fields.len == 0) ns: {
        break :ns try createNamespace(call);
    } else cls: {
        const class_name = createString(call, name);
        const thunk = createConstructorThunk(T);
        break :cls try createClass(call, class_name, thunk);
    };
    try attachDeclarations(call, container, T, info.decls);
    try attachUnionFields(call, container, T, info.fields);
    if (info.fields.len > 0) {
        try setSlotObject(call, container, .{ .Union = T });
    }
    return container;
}

fn exportEnumeration(call: Call, comptime T: type, comptime name: []const u8) !Enumeration {
    const info = @typeInfo(T).Enum;
    const enum_name = createString(call, name);
    const thunk = createEnumerationThunk(T);
    const container = try createEnumeration(call, enum_name, thunk);
    try attachDeclarations(call, container, T, info.decls);
    try attachEnumerationFields(call, container, T, info.fields);
    try setSlotObject(call, container, .{ .Enum = T });
    return container;
}

pub fn createRootFactory(comptime S: type) Factory {
    const RootFactory = struct {
        fn exportModule(call: Call, dest: *Namespace) callconv(.C) Result {
            if (exportStructure(call, S, "root")) |ns| {
                dest.* = ns;
                return .OK;
            } else |_| {
                return .Failure;
            }
        }
    };
    return RootFactory.exportModule;
}

pub fn createModule(comptime S: type) Module {
    return .{
        .version = api_version,
        .callbacks = &callbacks,
        .factory = createRootFactory(S),
    };
}
