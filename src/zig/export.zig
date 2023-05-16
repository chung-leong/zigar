const std = @import("std");
pub const api_version = 1;

// error that can occur during type conversion
const Error = error{
    UnsupportedConversion,
    IntegerOverflow,
    FloatUnderflow,
    FloatOverflow,
};

// enum and structs used by both Zig and C++ code
const Result = enum(c_int) {
    Success,
    Failure,
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
const ValueTypes = packed struct(i64) {
    number: bool = false,
    bigInt: bool = false,
    string: bool = false,
    array: bool = false,
    object: bool = false,
    typedArray: bool = false,
    arrayBuffer: bool = false,
    _: u57 = 0,
};
const FunctionAttributes = packed struct(i64) {
    throwing: bool = false,
    allocating: bool = false,
    suspending: bool = false,
    referencing: bool = false,
    _: u60 = 0,
};
const Value = *opaque {};
const Pool = *opaque {};
const Isolate = *opaque {};
const CallInfo = *opaque {};
const TypedArray = extern struct {
    bytes: [*]u8,
    len: usize,
    element_type: ElementType,
};
const ValueWithTypes = extern struct {
    value: Value,
    type: ValueTypes,
};

// data types that appear in the exported module struct
// need to keep these in sync with their C++ definitions as well
const Thunk = *const fn (isolate: Isolate, info: CallInfo, pool: Pool) callconv(.C) void;
const EntryType = enum(c_int) {
    unavailable = 0,
    function,
    variable,
    enumeration,
};
const Argument = extern struct {
    name: [*]const u8,
    class_name: ?[*]const u8,
    possible_types: ValueTypes,
};
const Function = extern struct {
    thunk: Thunk,
    attributes: FunctionAttributes,
    arguments: [*]const Argument,
    argument_count: usize,
    return_class_name: ?[*]const u8,
    return_default_type: ValueTypes,
    return_possible_types: ValueTypes,
};
const Variable = extern struct {
    getter_thunk: Thunk,
    setter_thunk: ?Thunk,
    class_name: ?[*]const u8,
    default_type: ValueTypes,
    possible_types: ValueTypes,
};
const EnumerationItem = extern struct {
    name: [*:0]const u8,
    value: i64,
};
const Enumeration = extern struct {
    items: [*]const EnumerationItem,
    count: usize,
    is_signed: c_int,
    default_type: ValueTypes,
    possible_types: ValueTypes,
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
    entries: EntryTable,
};

// function-pointer table that's filled on the C++ side
const Callbacks = extern struct {
    get_argument_count: *const fn (info: CallInfo) callconv(.C) usize,
    get_argument: *const fn (info: CallInfo, index: usize) callconv(.C) Value,
    get_argument_type: *const fn (info: CallInfo) callconv(.C) ValueTypes,
    get_return_type: *const fn (info: CallInfo) callconv(.C) ValueTypes,
    set_return_value: *const fn (info: CallInfo, retval: ?Value) callconv(.C) void,

    allocate_memory: *const fn (isolate: Isolate, pool: Pool, size: usize, dest: *TypedArray) callconv(.C) Result,
    reallocate_memory: *const fn (isolate: Isolate, pool: Pool, size: usize, dest: *TypedArray) callconv(.C) Result,
    free_memory: *const fn (isolate: Isolate, pool: Pool, dest: *TypedArray) callconv(.C) Result,

    is_null: *const fn (value: Value) callconv(.C) bool,
    is_string: *const fn (value: Value) callconv(.C) bool,
    is_object: *const fn (value: Value) callconv(.C) bool,
    is_array: *const fn (value: Value) callconv(.C) bool,
    is_array_buffer: *const fn (value: Value) callconv(.C) bool,

    convert_to_bool: *const fn (isolate: Isolate, value: Value, dest: *bool) callconv(.C) Result,
    convert_to_i32: *const fn (isolate: Isolate, value: Value, dest: *i32) callconv(.C) Result,
    convert_to_u32: *const fn (isolate: Isolate, value: Value, dest: *u32) callconv(.C) Result,
    convert_to_i64: *const fn (isolate: Isolate, value: Value, dest: *i64) callconv(.C) Result,
    convert_to_u64: *const fn (isolate: Isolate, value: Value, dest: *u64) callconv(.C) Result,
    convert_to_f64: *const fn (isolate: Isolate, value: Value, dest: *f64) callconv(.C) Result,
    convert_to_utf8: *const fn (isolate: Isolate, pool: Pool, value: Value, dest: *TypedArray) callconv(.C) Result,
    convert_to_utf16: *const fn (isolate: Isolate, pool: Pool, value: Value, dest: *TypedArray) callconv(.C) Result,
    convert_to_typed_array: *const fn (isolate: Isolate, value: Value, dest: *TypedArray) callconv(.C) Result,

    convert_from_bool: *const fn (isolate: Isolate, value: bool, dest: *Value) callconv(.C) Result,
    convert_from_i32: *const fn (isolate: Isolate, value: i32, dest: *Value) callconv(.C) Result,
    convert_from_u32: *const fn (isolate: Isolate, value: u32, dest: *Value) callconv(.C) Result,
    convert_from_i64: *const fn (isolate: Isolate, value: i64, dest: *Value) callconv(.C) Result,
    convert_from_u64: *const fn (isolate: Isolate, value: u64, dest: *Value) callconv(.C) Result,
    convert_from_f64: *const fn (isolate: Isolate, value: f64, dest: *Value) callconv(.C) Result,
    convert_from_utf8: *const fn (isolate: Isolate, pool: Pool, value: *TypedArray, dest: *Value) callconv(.C) Result,
    convert_from_utf16: *const fn (isolate: Isolate, pool: Pool, value: *TypedArray, dest: *Value) callconv(.C) Result,
    convert_from_typed_array: *const fn (isolate: Isolate, value: *TypedArray, dest: *Value) callconv(.C) Result,

    throw_exception: *const fn (isolate: Isolate, message: [*:0]const u8) void,
};
var callbacks: Callbacks = undefined;

// compile-time functions
fn isScalar(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float => true,
        else => false,
    };
}

fn isNumber(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int, .Float => true,
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
        .Bool, .Int, .Float => isScalar(true),
        .Array => |ar| isBinaryKnown(ar.child),
        .Struct => |st| switch (st.layout) {
            .Extern => true,
            .Packed => if (st.backing_integer) true else false,
        },
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

fn IntermediateType(comptime T: type) type {
    return switch (T) {
        i8, i16 => i32,
        u8, u16 => u32,
        f16, f32, f80, f128 => f64,
        else => T,
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

fn getPossibleTypes(comptime T: type, comptime out: bool) ValueTypes {
    var can_be: ValueTypes = .{};
    switch (comptime @typeInfo(T)) {
        .Int, .Float => {
            can_be.number = true;
            can_be.bigInt = true;
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
                can_be.typedArray = can_be.arrayBuffer;
                can_be.string = isUnicode(pt.child);
            }
        },
        else => {},
    }
    return can_be;
}

fn getReturnType(comptime T: type) ValueTypes {
    var prefer: ValueTypes = .{};
    switch (comptime @typeInfo(T)) {
        .Int, .Float => {
            prefer.number = true;
        },
        .Array => |ar| {
            if (isUnicode(ar.child)) {
                prefer.string = true;
            } else if (isNumber(ar.child)) {
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
                } else if (isNumber(pt.child)) {
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

// run-time helper functions
fn checkOverflow(value: anytype, comptime T: type) !void {
    switch (comptime @typeInfo(T)) {
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
        if (callback(isolate, value, &result) != .Success) {
            return Error.UnsupportedConversion;
        }
        if (comptime BT != IT) {
            // need to check for overflow and cast to final type
            try checkOverflow(result, BT);
            return if (comptime isInt(T)) @intCast(BT, result) else @floatCast(BT, result);
        }
        return result;
    } else if (comptime isArray(T)) {
        //
    } else if (comptime isSlice(T)) {
        const CT = ChildType(T);
        // convert to string unless incoming value is an ArrayBuffer
        if (!callbacks.is_array_buffer(isolate, value)) {
            const callback = @field(callbacks, std.fmt.comptimePrint("convert_to_utf_{d}", .{@bitSizeOf(CT)}));
            var result: TypedArray = undefined;
            if (callback(isolate, value, pool, &result) != .Success) {
                return Error.UnsupportedConversion;
            }
            var len = if (CT == u8) result.len else result.len >> 1;
            const ptr = @ptrCast([*]CT, @alignCast(@alignOf(CT), result.bytes));
            return ptr[0..len];
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
        if (callback(isolate, i_value, &result) != .Success) {
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

// thunk creation functions (compile-time)
fn createThunk(comptime package: anytype, comptime name: []const u8) Thunk {
    const function = @field(package, name);
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const ThunkType = struct {
        fn ga(isolate: Isolate, info: CallInfo, pool: Pool, index_ptr: *usize, count: i32, comptime T: type) ?T {
            if (comptime T == std.mem.Allocator) {
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
            if (comptime c > 32) {
                throwException(iso, "{s}() has more than 32 arguments", .{name});
                return;
            }
            var i: usize = 0;
            if (comptime c > 0) args[0] = ga(iso, info, pool, &i, c, f[0].type) orelse return;
            if (comptime c > 1) args[1] = ga(iso, info, pool, &i, c, f[1].type) orelse return;
            if (comptime c > 2) args[2] = ga(iso, info, pool, &i, c, f[2].type) orelse return;
            if (comptime c > 3) args[3] = ga(iso, info, pool, &i, c, f[3].type) orelse return;
            if (comptime c > 4) args[4] = ga(iso, info, pool, &i, c, f[4].type) orelse return;
            if (comptime c > 5) args[5] = ga(iso, info, pool, &i, c, f[5].type) orelse return;
            if (comptime c > 6) args[6] = ga(iso, info, pool, &i, c, f[6].type) orelse return;
            if (comptime c > 7) args[7] = ga(iso, info, pool, &i, c, f[7].type) orelse return;
            if (comptime c > 8) args[8] = ga(iso, info, pool, &i, c, f[8].type) orelse return;
            if (comptime c > 9) args[9] = ga(iso, info, pool, &i, c, f[9].type) orelse return;
            if (comptime c > 10) args[10] = ga(iso, info, pool, &i, c, f[10].type) orelse return;
            if (comptime c > 11) args[11] = ga(iso, info, pool, &i, c, f[11].type) orelse return;
            if (comptime c > 12) args[12] = ga(iso, info, pool, &i, c, f[12].type) orelse return;
            if (comptime c > 13) args[13] = ga(iso, info, pool, &i, c, f[13].type) orelse return;
            if (comptime c > 14) args[14] = ga(iso, info, pool, &i, c, f[14].type) orelse return;
            if (comptime c > 15) args[15] = ga(iso, info, pool, &i, c, f[15].type) orelse return;
            if (comptime c > 16) args[16] = ga(iso, info, pool, &i, c, f[16].type) orelse return;
            if (comptime c > 17) args[17] = ga(iso, info, pool, &i, c, f[17].type) orelse return;
            if (comptime c > 18) args[18] = ga(iso, info, pool, &i, c, f[18].type) orelse return;
            if (comptime c > 19) args[19] = ga(iso, info, pool, &i, c, f[19].type) orelse return;
            if (comptime c > 20) args[20] = ga(iso, info, pool, &i, c, f[20].type) orelse return;
            if (comptime c > 21) args[21] = ga(iso, info, pool, &i, c, f[21].type) orelse return;
            if (comptime c > 22) args[22] = ga(iso, info, pool, &i, c, f[22].type) orelse return;
            if (comptime c > 23) args[23] = ga(iso, info, pool, &i, c, f[23].type) orelse return;
            if (comptime c > 24) args[24] = ga(iso, info, pool, &i, c, f[24].type) orelse return;
            if (comptime c > 25) args[25] = ga(iso, info, pool, &i, c, f[25].type) orelse return;
            if (comptime c > 26) args[26] = ga(iso, info, pool, &i, c, f[26].type) orelse return;
            if (comptime c > 27) args[27] = ga(iso, info, pool, &i, c, f[27].type) orelse return;
            if (comptime c > 28) args[28] = ga(iso, info, pool, &i, c, f[28].type) orelse return;
            if (comptime c > 29) args[29] = ga(iso, info, pool, &i, c, f[29].type) orelse return;
            if (comptime c > 30) args[30] = ga(iso, info, pool, &i, c, f[30].type) orelse return;
            if (comptime c > 31) args[31] = ga(iso, info, pool, &i, c, f[31].type) orelse return;

            var result = @call(std.builtin.CallModifier.auto, function, args);
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
                const fmt = "Error encountered while converting {s} to JavaScript value for return value of {s}(): {s}";
                throwException(iso, fmt, .{ @typeName(T), name, @errorName(err) });
                return;
            }
        }
    };
    return ThunkType.cfn;
}

fn createGetterThunk(comptime package: anytype, comptime name: []const u8) Thunk {
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

fn createSetterThunk(comptime package: anytype, comptime name: []const u8) Thunk {
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

// functions that create the module struct at compile time
fn createFunction(comptime package: anytype, comptime name: []const u8) Function {
    const function = @field(package, name);
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const fields = std.meta.fields(Args);
    var arguments: [fields.len]Argument = undefined;
    var index = 0;
    for (fields) |field| {
        if (field.type == std.mem.Allocator) {
            continue;
        }
        arguments[index] = .{
            .name = createString(field.name),
            .class_name = "",
            .possible_types = getPossibleTypes(field.type, false),
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
    const writable = false;
    const T = @TypeOf(@field(package, name));
    return .{
        .getter_thunk = createGetterThunk(package, name),
        .setter_thunk = if (writable) createSetterThunk(package, name) else null,
        .class_name = null,
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
    var default_type: ValueTypes = .{ .number = true };
    var possible_types: ValueTypes = .{ .number = true, .bigInt = true };
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
        .items = entries,
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
                        .type = EntryType.enum_set,
                        .params = .{ .enumeration = &createEnumeration(package, name) },
                    },
                    else => null,
                },
                .Fn => .{
                    .type = EntryType.function,
                    .params = .{ .function = &createFunction(package, name) },
                },
                else => .{
                    .type = EntryType.variable,
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
        .entries = createEntryTable(package),
    };
}
