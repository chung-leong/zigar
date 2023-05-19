const std = @import("std");
pub const api_version = 1;

//-----------------------------------------------------------------------------
//  Errors that might occur during type conversion
//-----------------------------------------------------------------------------
const Error = error{
    UnsupportedConversion,
    IntegerOverflow,
    IntegerUnderflow,
    FloatUnderflow,
    FloatOverflow,
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
    EGeneric,
    EOverflow,
};
const ElementType = enum(c_int) {
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
    element_type: ElementType,
};

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
    get_argument_type: *const fn (call: Call) callconv(.C) ValueMask,
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

    convert_to_bool: *const fn (call: Call, value: Value, dest: *bool) callconv(.C) Result,
    convert_to_integer: *const fn (call: Call, value: Value, dest: *i64) callconv(.C) Result,
    convert_to_float: *const fn (call: Call, value: Value, dest: *f64) callconv(.C) Result,
    convert_to_utf8: *const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,
    convert_to_utf16: *const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,
    convert_to_typed_array: *const fn (call: Call, value: Value, dest: *TypedArray) callconv(.C) Result,

    convert_from_bool: *const fn (call: Call, value: bool, dest: *Value) callconv(.C) Result,
    convert_from_integer: *const fn (call: Call, value: i64, dest: *Value) callconv(.C) Result,
    convert_from_float: *const fn (call: Call, value: f64, dest: *Value) callconv(.C) Result,
    convert_from_utf8: *const fn (call: Call, value: *TypedArray, dest: *Value) callconv(.C) Result,
    convert_from_utf16: *const fn (call: Call, value: *TypedArray, dest: *Value) callconv(.C) Result,
    convert_from_typed_array: *const fn (call: Call, value: *TypedArray, dest: *Value) callconv(.C) Result,

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
            can_be.string = !out;
        },
        .Float => {
            can_be.number = true;
            can_be.string = !out;
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
        .Int, .Float => {
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
fn convertTo(call: Call, value: Value, comptime T: type) !T {
    if (comptime isOptional(T)) {
        if (callbacks.is_null(call, value)) {
            return null;
        }
    }
    const BT = BaseType(T);
    if (comptime isBool(BT)) {
        var result: bool = undefined;
        if (callbacks.convert_to_bool(call, value, &result) != .OK) {
            return Error.UnsupportedConversion;
        }
        return result;
    } else if (comptime isInt(BT)) {
        var result: i64 = undefined;
        if (callbacks.convert_to_integer(call, value, &result) != .OK) {
            return Error.UnsupportedConversion;
        }
        if (comptime std.math.maxInt(BT) < std.math.maxInt(i64)) {
            // need to check for overflow and cast to final type
            if (result < std.math.minInt(BT)) {
                return Error.IntegerUnderflow;
            } else if (result > std.math.maxInt(BT)) {
                return Error.IntegerOverflow;
            }
        }
        return @intCast(BT, result);
    } else if (comptime isFloat(BT)) {
        var result: f64 = undefined;
        if (callbacks.convert_to_float(call, value, &result) != .OK) {
            return Error.UnsupportedConversion;
        }
        if (comptime @field(std.math, @typeName(BT) ++ "_max") < std.math.f64_max) {
            if (result < @field(std.math, @typeName(BT) ++ "_min")) {
                return Error.FloatUnderflow;
            } else if (result > @field(std.math, @typeName(BT) ++ "_max")) {
                return Error.FloatOverflow;
            }
        }
        return @floatCast(BT, result);
    } else if (comptime isArray(T)) {
        //
    } else if (comptime isSlice(T)) {
        const CT = ChildType(T);

        // convert to string unless incoming value is an ArrayBuffer
        if (!callbacks.is_array_buffer(call, value)) {
            const callback = @field(callbacks, std.fmt.comptimePrint("convert_to_utf_{d}", .{@bitSizeOf(CT)}));
            var result: TypedArray = undefined;
            if (callback(call, value, &result) != .OK) {
                return Error.UnsupportedConversion;
            }
            var len = if (CT == u8) result.len else result.len >> 1;
            const ptr = @ptrCast([*]CT, @alignCast(@alignOf(CT), result.bytes));
            return ptr[0..len];
        }
    }
    return Error.UnsupportedConversion;
}

fn convertFrom(call: Call, value: anytype) !?Value {
    const T = @TypeOf(value);
    if (T == void) {
        return null;
    }
    if (comptime isOptional(T)) {
        return if (value) |v| convertFrom(call, v) else null;
    }
    if (comptime isBool(T)) {
        var result: Value = undefined;
        if (callbacks.convert_from_bool(call, value, &result) != .OK) {
            return Error.UnsupportedConversion;
        }
        return result;
    } else if (comptime isInt(T)) {
        var result: Value = undefined;
        if (callbacks.convert_from_integer(call, @intCast(i64, value), &result) != .OK) {
            return Error.UnsupportedConversion;
        }
        return result;
    } else if (comptime isFloat(T)) {
        var result: Value = undefined;
        if (callbacks.convert_from_float(call, @floatCast(f64, value), &result) != .OK) {
            return Error.UnsupportedConversion;
        }
        return result;
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
                i_ptr.* = index + 1;
                if (convertTo(call, arg, T)) |value| {
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
                if (convertFrom(call, result)) |value| {
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
            if (convertFrom(call, field)) |v| {
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
            if (convertTo(call, arg, T)) |value| {
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
