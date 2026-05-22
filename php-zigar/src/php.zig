const std = @import("std");

const debug = @import("debug.zig");
const failure = @import("failure.zig");
const fn_transform = @import("zigft/fn-transform.zig");

pub const php_h = @cImport({
    @cInclude("php.h");
    @cInclude("zend_builtin_functions.h");
    @cInclude("zend_exceptions.h");
    @cInclude("zend_fibers.h");
    @cInclude("zend_interfaces.h");
    @cInclude("zend_closures.h");
    @cInclude("ext/standard/info.h");
});

pub const ArgInfo = php_h.zend_internal_arg_info;
pub const Array = php_h.zend_array;
pub const ClassEntry = php_h.zend_class_entry;
pub const CompilerGlobals = php_h.zend_compiler_globals;
pub const DirEntry = php_h.php_stream_dirent;
pub const ExecutorGlobals = php_h.zend_executor_globals;
pub const ExecuteData = php_h.zend_execute_data;
pub const Fiber = php_h.zend_fiber;
pub const FiberTransfer = php_h.zend_fiber_transfer;
pub const Function = php_h.zend_function;
pub const FunctionEntry = extern struct {
    // zig_handler for some reason causes a "dependency loop detected" error
    // need to change it to *const anyopaque
    fname: [*c]const u8,
    handler: *const anyopaque,
    arg_info: [*c]const php_h.zend_internal_arg_info,
    num_args: u32,
    flags: u32,
};
pub const FunctionInfo = php_h.zend_internal_function_info;
pub const HashPosition = php_h.HashPosition;
pub const HashTable = php_h.HashTable;
pub const Long = php_h.zend_long;
pub const ModuleEntry = extern struct {
    size: c_ushort,
    zend_api: c_uint,
    zend_debug: u8,
    zts: u8,
    ini_entry: [*c]const php_h.zend_ini_entry,
    deps: [*c]const php_h.zend_module_dep,
    name: [*c]const u8,
    functions: [*c]const FunctionEntry,
    module_startup_func: ?*const fn (c_int, c_int) callconv(.c) php_h.zend_result,
    module_shutdown_func: ?*const fn (c_int, c_int) callconv(.c) php_h.zend_result,
    request_startup_func: ?*const fn (c_int, c_int) callconv(.c) php_h.zend_result,
    request_shutdown_func: ?*const fn (c_int, c_int) callconv(.c) php_h.zend_result,
    info_func: ?*const fn ([*c]@This()) callconv(.c) void,
    version: [*c]const u8,
    globals_size: usize,
    globals_ptr: ?*anyopaque,
    globals_ctor: ?*const fn (?*anyopaque) callconv(.c) void,
    globals_dtor: ?*const fn (?*anyopaque) callconv(.c) void,
    post_deactivate_func: ?*const fn () callconv(.c) php_h.zend_result,
    module_started: c_int,
    type: u8,
    handle: ?*anyopaque,
    module_number: c_int,
    build_id: [*c]const u8,
};
pub const Object = php_h.zend_object;
pub const ObjectHandlers = php_h.zend_object_handlers;
pub const ObjectIterator = php_h.zend_object_iterator;
pub const ObjectIteratorFunctions = php_h.zend_object_iterator_funcs;
pub const RefCounted = php_h.zend_refcounted;
pub const Reference = php_h.zend_reference;
pub const Resource = php_h.zend_resource;
pub const Result = php_h.zend_result;
pub const Stream = php_h.php_stream;
pub const StreamContext = php_h.php_stream_context;
pub const String = php_h.zend_string;
pub const Ulong = php_h.zend_ulong;
pub const Value = php_h.zval;

pub const SUCCESS = php_h.SUCCESS;
pub const FAILURE = php_h.FAILURE;

pub const BP_VAR_R = php_h.BP_VAR_R;
pub const BP_VAR_W = php_h.BP_VAR_W;
pub const BP_VAR_RW = php_h.BP_VAR_RW;
pub const BP_VAR_IS = php_h.BP_VAR_IS;
pub const BP_VAR_FUNC_ARG = php_h.BP_VAR_FUNC_ARG;
pub const BP_VAR_UNSET = php_h.BP_VAR_UNSET;

pub const MAY_BE_UNDEF = php_h.MAY_BE_UNDEF;
pub const MAY_BE_NULL = php_h.MAY_BE_NULL;
pub const MAY_BE_BOOL = php_h.MAY_BE_BOOL;
pub const MAY_BE_LONG = php_h.MAY_BE_LONG;
pub const MAY_BE_DOUBLE = php_h.MAY_BE_DOUBLE;
pub const MAY_BE_STRING = php_h.MAY_BE_STRING;
pub const MAY_BE_ARRAY = php_h.MAY_BE_ARRAY;
pub const MAY_BE_OBJECT = php_h.MAY_BE_OBJECT;

pub const PURPOSE_DEBUG = 0;
pub const PURPOSE_ARRAY_CAST = 1;
pub const PURPOSE_SERIALIZE = 2;
pub const PURPOSE_VAR_EXPORT = 3;
pub const PURPOSE_JSON = 4;
pub const PURPOSE_NON_EXHAUSTIVE_ENUM = 5;

pub const INTERNAL_CLASS = php_h.ZEND_INTERNAL_CLASS;
pub const USER_CLASS = php_h.ZEND_USER_CLASS;
pub const INTERNAL_FUNCTION = php_h.ZEND_INTERNAL_FUNCTION;
pub const USER_FUNCTION = php_h.ZEND_USER_FUNCTION;

pub const ANON_CLASS = php_h.ZEND_ACC_ANON_CLASS;
pub const FINAL = php_h.ZEND_ACC_FINAL;
pub const LINKED = php_h.ZEND_ACC_LINKED;
pub const NO_DYNAMIC_PROPERTIES = php_h.ZEND_ACC_NO_DYNAMIC_PROPERTIES;
pub const NOT_SERIALIZABLE = php_h.ZEND_ACC_NOT_SERIALIZABLE;
pub const RESOLVED_INTERFACES = php_h.ZEND_ACC_RESOLVED_INTERFACES;
pub const STRICT_TYPES = php_h.ZEND_ACC_STRICT_TYPES;

pub const std_object_handlers = &php_h.std_object_handlers;
pub const empty_array = &php_h.zend_empty_array;

pub const empty_value: Value = .{ .u1 = .{ .type_info = php_h.IS_NULL } };

pub const use_tsrm = false;

fn Globals(comptime name: []const u8) type {
    return @TypeOf(&@field(php_h, name));
}

pub fn getGlobals(comptime name: []const u8) Globals(name) {
    if (use_tsrm) {
        @compileError("TODO");
    } else {
        return &@field(php_h, name);
    }
}

pub fn getCompilerGlobals() *CompilerGlobals {
    return getGlobals("compiler_globals");
}

pub fn getExecutorGlobals() *ExecutorGlobals {
    return getGlobals("executor_globals");
}

const ArgPtrCountExtra = extern struct {
    ptr: [*]Value,
    len: usize,
    extra: bool,
};

extern fn get_argument_info(*ExecuteData, *ArgPtrCountExtra) void;

pub const ArgumentIterator = struct {
    arg_ptr: [*]Value,
    this: *Value,
    use_this_first: bool = false,
    named_params: ?Value,
    len: usize,
    total: usize,
    index: usize = 0,

    pub fn init(ed: *ExecuteData) @This() {
        var info: ArgPtrCountExtra = undefined;
        get_argument_info(ed, &info);
        var len = info.len;
        var total = len;
        const named = get: {
            if (info.extra) {
                // extra_named_params contains bogus values when it's not used
                if (ed.extra_named_params) |arr| {
                    len += 1;
                    total += arr.*.nNumOfElements;
                    break :get createValueArray(arr);
                }
            }
            break :get null;
        };
        return .{
            .arg_ptr = info.ptr,
            .len = len,
            .total = total,
            .this = &ed.This,
            .named_params = named,
        };
    }

    pub fn next(self: *@This()) ?*Value {
        if (self.index < self.len) {
            defer self.index += 1;
            var index = self.index;
            // return named parameters as last argument
            if (index == self.len - 1) {
                if (self.named_params) |*p| return p;
            }
            // return this pointer as first argument
            if (self.use_this_first) {
                if (index > 0) index -= 1 else return self.this;
            }
            // return regular argument
            return &self.arg_ptr[index];
        } else {
            return null;
        }
    }

    pub fn reset(self: *@This()) void {
        self.index = 0;
    }

    pub fn makeThisFirst(self: *@This()) void {
        if (!self.use_this_first) {
            self.use_this_first = true;
            self.len += 1;
        }
    }

    pub fn extractNamedArguments(self: *@This(), set: anytype, using: anytype) void {
        if (self.named_params == null) return;
        const ht = getValueHashTable(&self.named_params.?) catch unreachable;
        const T = @TypeOf(set.*);
        inline for (comptime std.meta.fieldNames(T)) |name| {
            if (@field(using, name)) {
                if (getHashEntry(ht, name) catch null) |value| {
                    @field(set, name) = value.*;
                    addRef(value);
                    _ = removeHashEntry(ht, name);
                }
            }
        }
        // if all named arguments were taken out, shrink the argument list
        if (ht.nNumOfElements == 0) {
            self.named_params = null;
            self.len -= 1;
        }
    }
};

fn TransformPointer(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .pointer => |pt| switch (pt.child) {
            anyopaque => if (pt.is_const) ?*const anyopaque else ?*anyopaque,
            else => if (pt.is_const) [*c]const pt.child else [*c]pt.child,
        },
        else => T,
    };
}

fn Transformed(comptime func: anytype) type {
    const func_info = @typeInfo(@TypeOf(func)).@"fn";
    const len = func_info.params.len;
    var params: [len]std.builtin.Type.Fn.Param = undefined;
    inline for (func_info.params, 0..) |param, i| {
        params[i] = .{
            .type = TransformPointer(param.type.?),
            .is_generic = param.is_generic,
            .is_noalias = param.is_noalias,
        };
    }
    const RT = func_info.return_type.?;
    // remove error
    const RTNE = switch (@typeInfo(RT)) {
        .error_union => |eu| eu.payload,
        else => RT,
    };
    return @Type(.{
        .@"fn" = .{
            .calling_convention = .c,
            .is_generic = false,
            .is_var_args = func_info.is_var_args,
            .params = &params,
            .return_type = TransformPointer(RTNE),
        },
    });
}

pub fn transform(comptime func: anytype) Transformed(func) {
    const PhpFnT = Transformed(func);
    const PhpArgs = std.meta.ArgsTuple(PhpFnT);
    const FnT = @TypeOf(func);
    const Args = std.meta.ArgsTuple(FnT);
    const PhpRT = @typeInfo(PhpFnT).@"fn".return_type.?;
    const ns = struct {
        fn call(php_args: PhpArgs) PhpRT {
            var args: Args = undefined;
            inline for (php_args, 0..) |php_arg, i| args[i] = switch (@typeInfo(@TypeOf(args[i]))) {
                .pointer => @ptrCast(php_arg.?),
                else => php_arg,
            };
            const retval = @call(.auto, func, args);
            return removeError(retval);
        }
    };
    return fn_transform.spreadArgs(ns.call, .c);
}

pub fn removeError(retval: anytype) switch (@typeInfo(@TypeOf(retval))) {
    .error_union => |eu| eu.payload,
    else => @TypeOf(retval),
} {
    const retval_ne = switch (@typeInfo(@TypeOf(retval))) {
        .error_union => |eu| retval catch |err| report: {
            throwError(err);
            break :report switch (eu.payload) {
                bool => false,
                void => {},
                c_int => FAILURE,
                else => |T| switch (@typeInfo(T)) {
                    .optional => null,
                    .pointer => |pt| switch (pt.is_allowzero) {
                        true => null,
                        false => undefined,
                    },
                    else => undefined,
                },
            };
        },
        else => retval,
    };
    return switch (@typeInfo(@TypeOf(retval_ne))) {
        .pointer => |pt| switch (pt.size) {
            .slice => retval_ne.ptr,
            else => retval_ne,
        },
        else => retval_ne,
    };
}

pub const initializeClassData = php_h.zend_initialize_class_data;

pub fn findClassEntry(comptime name: []const u8) ?*ClassEntry {
    return php_h.zend_lookup_class(persistent(name));
}

pub const ValueType = enum(u8) {
    undefined = php_h.IS_UNDEF, // 0
    null = php_h.IS_NULL, // 1
    false = php_h.IS_FALSE, // 2
    true = php_h.IS_TRUE, // 3
    long = php_h.IS_LONG, // 4
    double = php_h.IS_DOUBLE, // 5
    string = php_h.IS_STRING, // 6
    array = php_h.IS_ARRAY, // 7
    object = php_h.IS_OBJECT, // 8
    resource = php_h.IS_RESOURCE, // 9
    reference = php_h.IS_REFERENCE, // 10
    constant_ast = php_h.IS_CONSTANT_AST, // 11
    callable = php_h.IS_CALLABLE, // 12
    pointer = php_h.IS_PTR, // 13

    // fake types
    @"error" = php_h._IS_ERROR, // 15
    boolean = php_h._IS_BOOL, // 18
    number = php_h._IS_NUMBER, // 19

    pub fn fromInt(n: c_int) !@This() {
        return std.meta.intToEnum(@This(), n);
    }

    pub fn isBool(self: @This()) bool {
        return self == .false or self == .true;
    }

    pub fn isNumber(self: @This()) bool {
        return self == .long or self == .double;
    }
};

pub const GarbageCollectionColor = enum(u2) {
    black,
    white,
    grey,
    purple,

    pub fn get(obj: anytype) @This() {
        return @enumFromInt(obj.gc.u.type_info >> 30);
    }
};

pub fn isGarbage(arg: anytype) bool {
    return php_h.GC_INFO(arg) != 0;
}

pub fn isGmpClass(ce: *ClassEntry) bool {
    const name_str = ce.*.name orelse return false;
    const name = getStringContent(name_str);
    return std.mem.eql(u8, name, "GMP");
}

pub fn getValueType(value: *const Value) ValueType {
    return @enumFromInt(value.u1.v.type);
}

pub fn createValueNull() Value {
    var result: Value = .{};
    result.u1.type_info = php_h.IS_NULL;
    return result;
}

pub fn createValueBool(b: bool) Value {
    var result: Value = .{};
    result.u1.type_info = if (b) php_h.IS_TRUE else php_h.IS_FALSE;
    return result;
}

pub fn createValueLong(l: c_long) Value {
    var result: Value = .{};
    result.value.lval = l;
    result.u1.type_info = php_h.IS_LONG;
    return result;
}

pub fn createValueAnyInt(i: anytype) Value {
    const max = std.math.maxInt(c_long);
    const min = std.math.minInt(c_long);
    if (min <= i and i <= max) {
        const long: c_long = @intCast(i);
        return createValueLong(long);
    } else {
        const double: f32 = @floatFromInt(i);
        return createValueDouble(double);
    }
}

pub fn createValueDouble(d: f64) Value {
    var result: Value = .{};
    result.value.dval = d;
    result.u1.type_info = php_h.IS_DOUBLE;
    return result;
}

pub fn createValueString(s: *String) Value {
    var result: Value = .{};
    result.value.str = s;
    // non-interned string need to be gc'ed
    result.u1.type_info = switch (s.gc.u.type_info & php_h.IS_STR_INTERNED) {
        0 => php_h.IS_STRING_EX,
        else => php_h.IS_STRING,
    };
    return result;
}

pub fn createValueStringContent(sc: []const u8) Value {
    return createValueString(createString(sc));
}

pub inline fn createValuePersistentString(sc: []const u8) Value {
    return createValueString(persistent(sc));
}

pub fn createValueObject(object: ?*Object) Value {
    var result: Value = .{};
    result.value.obj = object orelse createStandardObject();
    result.u1.type_info = php_h.IS_OBJECT_EX;
    return result;
}

pub fn createValueReference(target: *const Value) Value {
    var result: Value = .{};
    const ref: *Reference = @ptrCast(@alignCast(emalloc(@sizeOf(Reference))));
    ref.gc = .{ .refcount = 1, .u = .{ .type_info = php_h.GC_REFERENCE } };
    ref.val = target.*;
    ref.sources = .{ .ptr = null };
    result.value.ref = ref;
    result.u1.type_info = php_h.IS_REFERENCE_EX;
    return result;
}

pub fn createValueNewObject(name: *const String, params: []const Value) !Value {
    var result: Value = undefined;
    const ce = php_h.zend_lookup_class(@constCast(name)) orelse return error.NonexistentClass;
    if (php_h.object_init_ex(&result, ce) != php_h.SUCCESS) return error.CannotCreateObject;
    const obj = result.value.obj;
    const ctor = obj.*.handlers.*.get_constructor.?(obj);
    if (ctor) |f| {
        php_h.zend_call_known_function(
            f,
            obj,
            obj.*.ce,
            null,
            @intCast(params.len),
            @constCast(params.ptr),
            null,
        );
    }
    return result;
}

pub fn createValuePointer(ptr: ?*anyopaque) Value {
    var result: Value = .{};
    result.value.ptr = ptr;
    result.u1.type_info = php_h.IS_PTR;
    return result;
}

pub fn createValueArray(arr: ?*Array) Value {
    var result: Value = .{};
    result.value.arr = arr orelse createArray();
    result.u1.type_info = php_h.IS_ARRAY_EX;
    return result;
}

pub fn createValueException() ?Value {
    const eg = getExecutorGlobals();
    const ex = eg.exception orelse return null;
    eg.exception = null;
    return createValueObject(ex);
}

pub fn createValueDebug(value: *const Value) Value {
    switch (getValueType(value)) {
        .object => {
            const obj = getValueObject(value) catch unreachable;
            return createValueString(obj.ce.*.name.?);
        },
        inline else => |t| {
            return createValueStringContent("(" ++ @tagName(t) ++ ")");
        },
    }
}

pub fn persistent(comptime s: []const u8) *String {
    const static = struct {
        comptime text: []const u8 = s,
        var string: ?*String = null;
    };
    return static.string orelse create: {
        const string = createPersistentString(s);
        static.string = string;
        break :create string;
    };
}

extern fn set_zval_stream(*Value, *Stream) void;

pub fn createValueStream(strm: *Stream) Value {
    var result: Value = .{};
    set_zval_stream(&result, strm);
    return result;
}

pub fn createValueClosure(func: *Function, scope: ?*ClassEntry, called_scope: ?*ClassEntry, this_ptr: ?*Value) Value {
    var result: Value = undefined;
    php_h.zend_create_closure(&result, func, scope, called_scope, this_ptr);
    return result;
}

pub fn convertValue(value: *Value, desired_type: ValueType) !void {
    switch (desired_type) {
        .boolean => php_h.convert_to_boolean(value),
        .long => php_h.convert_to_long(value),
        .string => php_h._convert_to_string(value),
        .array => php_h.convert_to_array(value),
        .object => php_h.convert_to_object(value),
        .double => php_h.convert_to_double(value),
        .null => php_h.convert_to_null(value),
        else => return error.Unexpected,
    }
}

pub fn compareValues(a: *const Value, b: *const Value) c_int {
    return php_h.zend_compare(@constCast(a), @constCast(b));
}

pub fn isValueNull(value: *const Value) bool {
    return value.u1.v.type == php_h.IS_NULL;
}

pub fn getValueNull(value: *const Value) !void {
    return switch (value.u1.v.type) {
        php_h.IS_NULL => {},
        else => error.NotNull,
    };
}

pub fn getValueBool(value: *const Value) !bool {
    return switch (value.u1.v.type) {
        php_h.IS_TRUE => true,
        php_h.IS_FALSE => false,
        else => error.NotBoolean,
    };
}

pub fn getValueLong(value: *const Value) !c_long {
    return switch (value.u1.v.type) {
        php_h.IS_LONG => value.value.lval,
        php_h.IS_STRING => convert: {
            const s: [*c]u8 = &value.value.str.*.val;
            const len = value.value.str.*.len;
            var long: Long = undefined;
            var double: f64 = undefined;
            const result = php_h.is_numeric_string(s, len, &long, &double, false);
            break :convert switch (result) {
                php_h.IS_LONG => long,
                php_h.IS_DOUBLE => try doubleToLong(double),
                else => error.NotInteger,
            };
        },
        php_h.IS_DOUBLE => convert: {
            break :convert try doubleToLong(value.value.dval);
        },
        else => error.NotInteger,
    };
}

fn doubleToLong(value: f64) !Long {
    // TODO: check for overflow
    const long: Long = @intFromFloat(value);
    const double: f64 = @floatFromInt(long);
    return switch (double == value) {
        true => long,
        else => error.NotInteger,
    };
}

pub fn getValueUlong(value: *const Value) !c_ulong {
    const long = try getValueLong(value);
    if (long < 0) return error.NegativeValue;
    return @intCast(long);
}

pub fn getValueUsize(value: *const Value) !usize {
    const long = try getValueLong(value);
    return @bitCast(long);
}

pub fn getValueDouble(value: *const Value) !f64 {
    return switch (value.u1.v.type) {
        php_h.IS_DOUBLE => value.value.dval,
        php_h.IS_STRING => convert: {
            const s: [*c]u8 = &value.value.str.*.val;
            const len = value.value.str.*.len;
            var long: Long = undefined;
            var double: f64 = undefined;
            const result = php_h.is_numeric_string(s, len, &long, &double, false);
            break :convert switch (result) {
                php_h.IS_DOUBLE => double,
                php_h.IS_LONG => try longToDouble(long),
                else => error.NotDouble,
            };
        },
        php_h.IS_LONG => convert: {
            break :convert try longToDouble(value.value.lval);
        },
        else => error.NotDouble,
    };
}

fn longToDouble(value: Long) !f64 {
    const double: f64 = @floatFromInt(value);
    const long: Long = @intFromFloat(double);
    return switch (long == value) {
        true => double,
        else => error.NotDouble,
    };
}

pub fn getValueString(value: *const Value) !*String {
    return switch (value.u1.v.type) {
        php_h.IS_STRING => value.value.str,
        else => error.NotString,
    };
}

pub fn getValueStringContent(value: *const Value) ![]const u8 {
    return switch (value.u1.v.type) {
        php_h.IS_STRING => getStringContent(value.value.str),
        else => error.NotString,
    };
}

pub fn getValueArray(value: *const Value) !*Array {
    return switch (value.u1.v.type) {
        php_h.IS_ARRAY => value.value.arr,
        else => error.NotArray,
    };
}

pub fn getValueStream(value: *const Value) !*Stream {
    if (value.u1.v.type == php_h.IS_RESOURCE) {
        const res_ptr = php_h.zend_fetch_resource2_ex(
            @constCast(value),
            "stream",
            php_h.php_file_le_stream(),
            php_h.php_file_le_pstream(),
        );
        if (res_ptr) |ptr| return @ptrCast(@alignCast(ptr));
    }
    return error.NotStream;
}

pub fn getValueHashTable(value: *const Value) !*HashTable {
    return switch (value.u1.v.type) {
        php_h.IS_ARRAY => value.value.arr,
        php_h.IS_OBJECT => value.value.obj.*.properties orelse error.NotArrayOrObject,
        else => error.NotArrayOrObject,
    };
}

pub fn getValueObject(value: *const Value) !*Object {
    return switch (value.u1.v.type) {
        php_h.IS_OBJECT => value.value.obj,
        else => error.NotObject,
    };
}

pub fn getValueReference(value: *const Value) !*Reference {
    return switch (value.u1.v.type) {
        php_h.IS_REFERENCE => value.value.ref,
        else => error.NotReference,
    };
}

pub fn getValuePointer(comptime T: type, value: *const Value) !T {
    return switch (value.u1.v.type) {
        php_h.IS_PTR => if (value.value.ptr) |p|
            @ptrCast(@alignCast(p))
        else
            error.NullPointer,
        else => error.NotPointer,
    };
}

pub fn getProperty(object: *const Value, key: anytype) !*Value {
    const ht = try getValueHashTable(object);
    return try getHashEntry(ht, key);
}

pub fn getPropertyWithType(comptime T: type, object: *Value, key: anytype) !T {
    const ht = try getValueHashTable(object);
    return try getHashEntryWithType(T, ht, key);
}

pub fn setProperty(object: *Value, key: anytype, value: *Value) !void {
    const ht = try getValueHashTable(object);
    setHashEntry(ht, key, value);
}

pub fn setPropertyRef(object: *Value, key: anytype, value: *Value) !void {
    try setProperty(object, key, value);
    addRef(value);
}

pub fn deleteProperty(object: *Value, key: anytype) !void {
    const ht = try getValueHashTable(object);
    deleteHashEntry(ht, key);
}

pub fn addElement(array: *Value, element: *Value) !void {
    const arr = try getValueArray(array);
    _ = appendHashEntry(arr, element);
}

pub fn addElementRef(array: *Value, element: *Value) !void {
    try addElement(array, element);
    addRef(element);
}

pub fn createString(s: []const u8) *String {
    return switch (s.len) {
        0 => php_h.zend_empty_string,
        1 => php_h.zend_one_char_string[s[0]],
        else => create: {
            const zs = php_h.zend_string_alloc(s.len, false);
            const ds: [*]u8 = @ptrCast(&zs.*.val[0]);
            @memcpy(ds[0..s.len], s);
            ds[s.len] = '\x00';
            break :create zs;
        },
    };
}

pub fn dupliateString(str: *String) *String {
    return php_h.zend_string_dup(str, false);
}

pub fn isStringInterned(str: *String) bool {
    return (str.gc.u.type_info & php_h.IS_STR_INTERNED) != 0;
}

pub fn createStringWithLength(len: usize) *String {
    const zs = switch (len) {
        0 => php_h.zend_empty_string,
        else => php_h.zend_string_alloc(len, false),
    };
    if (@intFromPtr(zs) == 0x00007f8beb601c40) @breakpoint();
    return zs;
}

pub fn createInternedString(s: []const u8) *String {
    return php_h.zend_string_init_interned.?(s.ptr, s.len, false);
}

pub fn createPersistentString(s: []const u8) *String {
    return php_h.zend_string_init_interned.?(s.ptr, s.len, true);
}

pub fn getStringContent(str: *const String) []const u8 {
    const s: [*]const u8 = @ptrCast(&str.*.val[0]);
    const len = str.*.len;
    return s[0..len];
}

pub fn compareStrings(s1: *const String, s2: *const String) bool {
    const sc1 = getStringContent(s1);
    const sc2 = getStringContent(s2);
    return std.mem.eql(u8, sc1, sc2);
}

pub fn matchString(s: *const String, text: []const u8) bool {
    const sc = getStringContent(s);
    return std.mem.eql(u8, sc, text);
}

pub fn createStandardObject() *Object {
    const obj = php_h.zend_objects_new(php_h.zend_standard_class_def);
    obj.*.properties = php_h._zend_new_array_0();
    return obj;
}

pub fn createArray() *Array {
    return php_h._zend_new_array_0();
}

pub fn createNonDestructiveArray() *Array {
    const bytes = emalloc(@sizeOf(HashTable));
    const ht: *HashTable = @ptrCast(@alignCast(bytes));
    php_h._zend_hash_init(ht, php_h.HT_MIN_SIZE, null, false);
    return ht;
}

pub fn isNormalArray(ht: *Array) bool {
    return ht.arData.*.key == null;
}

pub const destructor = struct {
    pub const function = php_h.zend_function_dtor;
    pub const value = php_h.zval_ptr_dtor;
};

pub fn createHashTable(dtor: php_h.dtor_func_t) HashTable {
    var result: HashTable = undefined;
    php_h._zend_hash_init(&result, php_h.HT_MIN_SIZE, dtor, false);
    return result;
}

pub fn destroyHashTable(ht: *HashTable) void {
    php_h.zend_hash_destroy(ht);
}

pub fn getHashEntry(ht: *const HashTable, key: anytype) !*Value {
    const KT = @TypeOf(key);
    if (KT == *Value or KT == *const Value) {
        return switch (getValueType(key)) {
            .long => getHashEntry(ht, key.value.lval),
            .string => getHashEntry(ht, key.value.str),
            else => @panic("Invalid key"),
        };
    }
    return if (comptime isStringContent(KT))
        php_h.zend_hash_str_find(ht, key.ptr, key.len) orelse error.Missing
    else if (comptime isString(KT))
        php_h.zend_hash_find(ht, key) orelse error.Missing
    else if (comptime isInt(KT))
        php_h.zend_hash_index_find(ht, @intCast(key)) orelse error.Missing
    else
        @compileError("Invalid key: " ++ @typeName(KT));
}

pub fn getHashEntryWithType(comptime T: type, ht: *const HashTable, key: anytype) !T {
    s: switch (@typeInfo(T)) {
        .@"enum" => |en| {
            const int = try getHashEntryWithType(en.tag_type, ht, key);
            return @enumFromInt(int);
        },
        .int => {
            const value = try getHashEntry(ht, key);
            const long = try getValueLong(value);
            return @intCast(long);
        },
        .optional => |op| {
            return getHashEntryWithType(op.child, ht, key) catch |err|
                if (err == error.Missing) null else err;
        },
        .@"struct" => |st| {
            if (st.backing_integer) |BT| {
                const int = try getHashEntryWithType(BT, ht, key);
                return @bitCast(int);
            } else break :s;
        },
        .@"union" => {
            const int_type_maybe: ?type = inline for (comptime std.meta.fields(T)) |field| {
                const FT = @FieldType(T, field.name);
                const field_int_type_maybe = switch (@typeInfo(FT)) {
                    .@"enum" => |en| en.tag_type,
                    .int => FT,
                    .@"struct" => |st| st.backing_integer,
                    else => null,
                };
                if (field_int_type_maybe) |FIT| {
                    break if (@sizeOf(FIT) == @sizeOf(T)) FIT else null;
                }
            } else null;
            if (int_type_maybe) |IT| {
                const int = try getHashEntryWithType(IT, ht, key);
                return @bitCast(int);
            }
        },
        else => @compileError("Function accepts only types that are represented by integers"),
    }
}

pub fn insertHashEntry(ht: *HashTable, key: anytype, value: *const Value) *Value {
    const KT = @TypeOf(key);
    if (KT == *Value or KT == *const Value) {
        return switch (getValueType(key)) {
            .long => insertHashEntry(ht, key.value.lval, value),
            .string => insertHashEntry(ht, key.value.str, value),
            else => @panic("Invalid key"),
        };
    }
    ht.*.u.flags |= php_h.HASH_FLAG_ALLOW_COW_VIOLATION;
    const result = if (comptime isStringContent(KT))
        php_h.zend_hash_str_update(ht, key.ptr, key.len, @constCast(value))
    else if (comptime isInt(KT))
        php_h.zend_hash_index_update(ht, @intCast(key), @constCast(value))
    else if (comptime isString(KT))
        php_h.zend_hash_update(ht, key, @constCast(value))
    else
        @compileError("Invalid key: " ++ @typeName(KT));
    return @ptrCast(result);
}

pub fn setHashEntry(ht: *HashTable, key: anytype, value: *const Value) void {
    _ = insertHashEntry(ht, key, value);
}

pub fn setHashEntryRef(ht: *HashTable, key: anytype, value: *const Value) void {
    defer addRef(value);
    setHashEntry(ht, key, value);
}

pub fn getHashNextKey(ht: *HashTable) Long {
    return ht.nNextFreeElement;
}

pub fn appendHashEntry(ht: *HashTable, value: *const Value) usize {
    ht.*.u.flags |= php_h.HASH_FLAG_ALLOW_COW_VIOLATION;
    _ = php_h.zend_hash_next_index_insert(ht, @constCast(value));
    return php_h.zend_hash_num_elements(ht);
}

pub fn appendHashEntryRef(ht: *HashTable, value: *const Value) usize {
    defer addRef(value);
    return appendHashEntry(ht, value);
}

pub fn removeHashEntry(ht: *HashTable, key: anytype) bool {
    const KT = @TypeOf(key);
    ht.*.u.flags |= php_h.HASH_FLAG_ALLOW_COW_VIOLATION;
    const result = if (comptime isStringContent(KT))
        php_h.zend_hash_str_del(ht, key.ptr, key.len)
    else if (comptime isString(KT))
        php_h.zend_hash_del(ht, key)
    else if (comptime isInt(KT))
        php_h.zend_hash_index_del(ht, @intCast(key))
    else
        @compileError("Invalid key: " ++ @typeName(KT));
    return result == SUCCESS;
}

pub fn deleteHashEntry(ht: *HashTable, key: anytype) void {
    _ = removeHashEntry(ht, key);
}

pub fn hasHashEntry(ht: *HashTable, key: anytype) bool {
    const KT = @TypeOf(key);
    return if (comptime isStringContent(KT))
        php_h.zend_hash_str_exists(ht, key.ptr, key.len)
    else if (comptime isString(KT))
        php_h.zend_hash_exists(ht, key)
    else if (comptime isInt(KT))
        php_h.zend_hash_index_exists(ht, @intCast(key))
    else
        @compileError("Invalid key: " ++ @typeName(KT));
}

pub const HashTableIterator = struct {
    ht: *HashTable,
    pos: HashPosition,
    dir: Direction,
    len: usize,
    key: ?Value = undefined,
    returned: bool = false,

    pub const Direction = enum { forward, backward };
    pub const Options = struct {
        dir: Direction = .forward,
    };

    pub fn init(ht: *const HashTable, options: Options) @This() {
        var pos: HashPosition = undefined;
        const nc_ht = @constCast(ht);
        switch (options.dir) {
            .forward => php_h.zend_hash_internal_pointer_reset_ex(nc_ht, &pos),
            .backward => php_h.zend_hash_internal_pointer_end_ex(nc_ht, &pos),
        }
        return .{
            .ht = nc_ht,
            .pos = pos,
            .len = ht.nNumOfElements,
            .dir = options.dir,
        };
    }

    pub fn reset(self: *@This()) void {
        switch (self.dir) {
            .forward => php_h.zend_hash_internal_pointer_reset_ex(self.ht, &self.pos),
            .backward => php_h.zend_hash_internal_pointer_end_ex(self.ht, &self.pos),
        }
        self.returned = false;
    }

    pub fn next(self: *@This()) ?*Value {
        defer self.returned = true;
        if (self.returned) {
            switch (self.dir) {
                .forward => _ = php_h.zend_hash_move_forward_ex(self.ht, &self.pos),
                .backward => _ = php_h.zend_hash_move_backwards_ex(self.ht, &self.pos),
            }
        }
        self.key = null;
        return php_h.zend_hash_get_current_data_ex(self.ht, &self.pos);
    }

    pub fn currentKey(self: *@This()) *Value {
        if (self.key == null) {
            var key: Value = undefined;
            php_h.zend_hash_get_current_key_zval_ex(self.ht, &key, &self.pos);
            self.key = key;
            // don't increment the key's refcount
            if (getValueType(&key) == .string) release(&key);
        }
        return &self.key.?;
    }

    pub fn currentIndex(self: *@This()) ?c_long {
        const key = self.currentKey();
        return getValueLong(key) catch null;
    }

    pub fn currentName(self: *@This()) ?*String {
        const key = self.currentKey();
        return getValueString(key) catch null;
    }
};

pub fn HashTableObjectIterator(comptime T: type) type {
    return struct {
        iter: HashTableIterator,
        len: usize = undefined,

        pub fn init(ht: *HashTable, options: HashTableIterator.Options) @This() {
            const iter: HashTableIterator = .init(ht, options);
            return .{ .iter = iter, .len = iter.len };
        }

        pub fn reset(self: *@This()) void {
            self.iter.reset();
        }

        pub fn next(self: *@This()) ?T {
            const value = self.iter.next() orelse return null;
            return getValuePointer(T, value) catch @panic("Not object");
        }

        pub fn currentKey(self: *@This()) *Value {
            return self.iter.currentKey();
        }

        pub fn currentIndex(self: *@This()) ?c_long {
            return self.iter.currentIndex();
        }

        pub fn currentName(self: *@This()) ?*String {
            return self.iter.currentName();
        }
    };
}

pub const initializeIterator = php_h.zend_iterator_init;
pub const freeIterator = php_h.zend_iterator_dtor;

pub fn readObjectProperty(obj: *const Object, name: *const String) Value {
    var value: Value = createValueNull();
    _ = php_h.zend_read_property_ex(obj.ce, @constCast(obj), @constCast(name), true, &value);
    return value;
}

pub fn addRef(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, *const Value, [*c]Value => {
            if (value.u1.type_info & php_h.Z_TYPE_FLAGS_MASK != 0) {
                _ = php_h.zval_addref_p(@constCast(value));
            }
        },
        *String, [*c]String => {
            _ = php_h.zend_string_addref(value);
        },
        *Object, [*c]Object, *HashTable, [*c]HashTable, *Resource, [*c]Resource => {
            _ = php_h.GC_ADDREF(value);
        },
        else => @compileError("Unexpected type: " ++ @typeName(T)),
    }
}

pub fn delRef(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, *const Value, [*c]Value => {
            if (value.u1.type_info & php_h.Z_TYPE_FLAGS_MASK != 0) {
                _ = php_h.zval_delref_p(@constCast(value));
            }
        },
        *String, [*c]String, *Object, [*c]Object, *HashTable, [*c]HashTable, *Resource, [*c]Resource => {
            _ = php_h.GC_DELREF(value);
        },
        else => {},
    }
}

pub fn release(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, *const Value, [*c]Value => php_h.zval_ptr_dtor(@constCast(value)),
        *String, [*c]String => php_h.zend_string_release(value),
        *Object, [*c]Object => php_h.zend_object_release(value),
        *HashTable, [*c]HashTable => php_h.zend_hash_release(value),
        *Resource, [*c]Resource => _ = php_h.zend_list_delete(value),
        else => @compileError("Unexpected type: " ++ @typeName(T)),
    }
}

pub fn isObjectFreed(obj: *Object) bool {
    return (obj.gc.u.type_info & php_h.IS_OBJ_FREE_CALLED) != 0;
}

pub fn isCallable(callable: *const Value) bool {
    return php_h.zend_is_callable(@constCast(callable), php_h.IS_CALLABLE_CHECK_SILENT, null);
}

pub fn invokeMethod(container: ?*const Value, fn_name: *const Value, arguments: []const Value) !Value {
    var retval: Value = undefined;
    const args = @constCast(arguments.ptr);
    const len: u32 = @intCast(arguments.len);
    if (php_h._call_user_function_impl(@constCast(container), @constCast(fn_name), &retval, len, args, null) != php_h.SUCCESS) {
        return error.Failure;
    }
    return retval;
}

pub fn invokeFunction(comptime name: []const u8, arguments: []const Value) !Value {
    const callable = createValueString(persistent(name));
    return try invokeMethod(null, &callable, arguments);
}

pub fn emptyArgInfo(comptime count: usize) []const ArgInfo {
    const rem = @rem(count, 8);
    if (rem > 0) {
        const larger = emptyArgInfo(count + (8 - rem));
        return larger[0..count];
    } else {
        const ns = struct {
            const array = init: {
                var buffer: [count]ArgInfo = undefined;
                for (&buffer) |*ptr| ptr.* = .{
                    .name = "",
                };
                break :init buffer;
            };
        };
        return &ns.array;
    }
}

pub fn createFunction(
    func_ptr: php_h.zif_handler,
    comptime name: []const u8,
    comptime arg_count: usize,
    comptime is_variadic: bool,
) Function {
    return createFunctionEx(func_ptr, persistent(name), arg_count, is_variadic);
}

pub fn createFunctionEx(
    func_ptr: php_h.zif_handler,
    name: *String,
    comptime arg_count: usize,
    comptime is_variadic: bool,
) Function {
    const arg_info = emptyArgInfo(arg_count + if (is_variadic) 1 else 0);
    var fn_flags: u32 = php_h.ZEND_ACC_PUBLIC;
    if (is_variadic) fn_flags |= php_h.ZEND_ACC_VARIADIC;
    return .{
        .internal_function = .{
            .type = php_h.ZEND_INTERNAL_FUNCTION,
            .function_name = name,
            .handler = func_ptr,
            .num_args = arg_count,
            .required_num_args = arg_count,
            .arg_info = @constCast(arg_info.ptr),
            .fn_flags = fn_flags,
        },
    };
}

pub inline fn createTransformedFunction(
    comptime func: anytype,
    name: []const u8,
    arg_count: usize,
    is_variadic: bool,
) Function {
    return createFunction(&transform(func), name, arg_count, is_variadic);
}

pub fn destroyFunction(func: *Function) void {
    if (func.internal_function.function_name) |n| release(n);
}

pub const instanceOf = php_h.instanceof_function;
pub const initializeStandardObject = php_h.zend_object_std_init;
pub const initializeObjectProperties = php_h.object_properties_init;
pub const registerInternalClass = php_h.zend_register_internal_class_ex;
pub const registerInternalInterface = php_h.zend_register_internal_interface;
pub const traceToString = php_h.zend_trace_to_string;

pub fn getObjectProperty(obj: *Object, name: *String) ?Value {
    var retval: Value = undefined;
    _ = php_h.zend_std_read_property(obj, name, BP_VAR_R, null, &retval);
    return retval;
}

pub fn getObjectPropertySize(ce: *ClassEntry) isize {
    return @bitCast(php_h.zend_object_properties_size(ce));
}

pub const InterfaceName = enum {
    aggregate,
    array_access,
    countable,
    iterator,
    serializable,
    stringable,
    traversable,
    throwable,
};

pub fn getInterface(itype: InterfaceName) *ClassEntry {
    const ptr = switch (itype) {
        .aggregate => php_h.zend_ce_aggregate,
        .array_access => php_h.zend_ce_arrayaccess,
        .countable => php_h.zend_ce_countable,
        .iterator => php_h.zend_ce_iterator,
        .serializable => php_h.zend_ce_serializable,
        .stringable => php_h.zend_ce_stringable,
        .traversable => php_h.zend_ce_traversable,
        .throwable => php_h.zend_ce_throwable,
    };
    return @ptrCast(ptr);
}

pub const ClassEntryName = enum {
    standard,
    exception,
};

pub fn getClassEntry(ctype: ClassEntryName) *ClassEntry {
    const ptr = switch (ctype) {
        .standard => php_h.zend_standard_class_def,
        .exception => php_h.zend_ce_exception,
    };
    return @ptrCast(ptr);
}

pub const PropPurpose = enum(c_uint) {
    debug = php_h.ZEND_PROP_PURPOSE_DEBUG,
    array_cast = php_h.ZEND_PROP_PURPOSE_ARRAY_CAST,
    serialize = php_h.ZEND_PROP_PURPOSE_SERIALIZE,
    var_export = php_h.ZEND_PROP_PURPOSE_VAR_EXPORT,
    json = php_h.ZEND_PROP_PURPOSE_JSON,

    pub fn fromInt(n: c_uint) !@This() {
        return std.meta.intToEnum(@This(), n);
    }
};

pub fn throwError(err: anytype) void {
    // if an exception has already been thrown then don't do anything
    if (failure.match(err, error.ExceptionThrown)) return;
    const msg = failure.acquireMessage(err);
    defer failure.freeMessage(msg);
    _ = php_h.zend_throw_exception_ex(null, 0, "%s (zig)", msg.ptr);
}

pub fn throwExceptionObject(obj: *Object) error{ExceptionThrown} {
    var value = createValueObject(obj);
    php_h.zend_throw_exception_object(&value);
    return error.ExceptionThrown;
}

pub fn getCurrentLine() u32 {
    return php_h.zend_get_executed_lineno();
}

pub fn getCurrentFile() *String {
    const path = php_h.zend_get_executed_filename();
    const len = std.mem.len(path);
    return createString(path[0..len]);
}

pub fn getBacktrace() !*Array {
    const eg = getExecutorGlobals();
    var trace: Value = undefined;
    php_h.zend_fetch_debug_backtrace(
        &trace,
        0,
        if (eg.exception_ignore_args) php_h.DEBUG_BACKTRACE_IGNORE_ARGS else 0,
        0,
    );
    return try getValueArray(&trace);
}

pub fn emalloc(size: usize) ?*anyopaque {
    if (php_h.ZEND_DEBUG == 1) {
        const src = @src();
        const ptr = php_h._emalloc(size, src.file, src.line + 1, null, 0);
        return ptr;
    } else {
        return php_h._emalloc(size);
    }
}

pub fn malloc(size: usize) ?*anyopaque {
    const ptr = php_h.__zend_malloc(size);
    return ptr;
}

pub fn efree(ptr: ?*anyopaque) void {
    if (php_h.ZEND_DEBUG == 1) {
        php_h._efree(ptr, "zig", 0, null, 0);
    } else {
        php_h.efree(ptr);
    }
}

pub fn estrdup(s: [*:0]const u8) [*:0]const u8 {
    if (php_h.ZEND_DEBUG == 1) {
        return php_h._estrdup(s, "zig", 0, null, 0);
    } else {
        return php_h._estrdup(s);
    }
}

pub const allocator: std.mem.Allocator = .{
    .ptr = undefined,
    .vtable = &allocator_impl.vtable,
};
const allocator_impl = struct {
    const vtable: std.mem.Allocator.VTable = .{
        .alloc = alloc,
        .resize = resize,
        .remap = remap,
        .free = free,
    };

    fn alloc(
        _: *anyopaque,
        len: usize,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) ?[*]u8 {
        _ = return_address;
        _ = alignment;
        std.debug.assert(len > 0);
        return @ptrCast(emalloc(len));
    }

    fn resize(
        _: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        return_address: usize,
    ) bool {
        _ = alignment;
        _ = return_address;
        std.debug.assert(new_len > 0);
        if (new_len <= memory.len) {
            return true; // in-place shrink always works
        }
        return false;
    }

    fn remap(
        ctx: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        return_address: usize,
    ) ?[*]u8 {
        std.debug.assert(new_len > 0);
        if (resize(ctx, memory, alignment, new_len, return_address)) {
            return memory.ptr;
        }
        return null;
    }

    fn free(
        _: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) void {
        _ = alignment;
        _ = return_address;
        efree(memory.ptr);
    }
};

pub var allocation_count: isize = 0;
pub var allocated_bytes: isize = 0;

fn isStringContent(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .pointer => |pt| switch (pt.size) {
            .slice => pt.child == u8,
            .one => switch (@typeInfo(pt.child)) {
                .array => |ar| ar.child == u8,
                else => false,
            },
            else => false,
        },
        else => false,
    };
}

fn isString(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .pointer => |pt| pt.child == String,
        else => false,
    };
}

fn isInt(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .int, .comptime_int => true,
        else => false,
    };
}

pub fn open(path: *const String, mode: [*c]const u8, context: ?*StreamContext, options: c_int) !*Stream {
    const p = getStringContent(path);
    var strm: ?*Stream = undefined;
    if (php_h.ZEND_DEBUG == 1) {
        const src = @src();
        strm = php_h._php_stream_open_wrapper_ex(p.ptr, mode, options, null, context, 1, src.file, src.line, src.file, src.line);
    } else {
        strm = php_h._php_stream_open_wrapper_ex(p.ptr, mode, options, null, context);
    }
    return strm orelse error.Failure;
}

pub const pipe = php_h.pipe;

extern fn get_stream_path(strm: *Stream) ?[*:0]const u8;
extern fn get_stream_flags(strm: *Stream) u32;
extern fn get_stream_handlers(strm: *Stream) *const php_h.php_stream_ops;
extern fn get_stream_mode(strm: *Stream) ?[*:0]const u8;
extern fn get_stream_wrapper_data(strm: *Stream) *Value;
extern fn set_stream_no_close(strm: *Stream) void;
extern fn is_stdio_stream(strm: *Stream) bool;

pub fn getStreamPath(strm: *Stream) ?[]const u8 {
    const ptr = get_stream_path(strm) orelse return null;
    const len = std.mem.len(ptr);
    return ptr[0..len];
}

pub fn getStreamMode(strm: *Stream) []const u8 {
    const ptr = get_stream_mode(strm) orelse "";
    const len = std.mem.len(ptr);
    return ptr[0..len];
}

pub fn preserveStream(strm: *Stream) void {
    set_stream_no_close(strm);
}

pub fn openDescriptor(fd: c_int, mode: [*c]const u8) !*Stream {
    var strm: ?*Stream = undefined;
    if (php_h.ZEND_DEBUG == 1) {
        const src = @src();
        strm = php_h._php_stream_fopen_from_fd(fd, mode, null, 1, src.file, src.line, src.file, src.line);
    } else {
        strm = php_h._php_stream_fopen_from_fd(fd, mode, null);
    }
    return strm orelse error.Failure;
}

pub fn getDescriptor(strm: *Stream) ?c_int {
    if (!is_stdio_stream(strm)) return null;
    return inline for (.{ php_h.PHP_STREAM_AS_FD_FOR_SELECT, php_h.PHP_STREAM_AS_FD }) |as| {
        var fd: c_int align(@alignOf(*anyopaque)) = undefined;
        if (php_h._php_stream_cast(strm, as, @ptrCast(&fd), 0) == SUCCESS) {
            break fd;
        }
    } else null;
}

pub fn close(strm: *Stream) void {
    _ = php_h.php_stream_close(strm);
}

pub fn flush(strm: *Stream) void {
    _ = php_h.php_stream_flush(strm);
}

pub fn read(strm: *Stream, buf: [*]const u8, size: usize) !usize {
    const r = php_h._php_stream_read(strm, @constCast(buf), size);
    if (r < 0) return error.Failure;
    return @intCast(r);
}

pub fn write(strm: *Stream, buf: [*]const u8, size: usize) !usize {
    const w = php_h._php_stream_write(strm, buf, size);
    if (w < 0) return error.Failure;
    return @intCast(w);
}

pub fn seek(strm: *Stream, offset: i64, whence: u32) !void {
    const ops = get_stream_handlers(strm);
    const flags = get_stream_flags(strm);
    if (ops.seek == null) return error.Unseekable;
    if (flags & php_h.PHP_STREAM_FLAG_NO_SEEK != 0) return error.Unseekable;
    const pos = php_h._php_stream_seek(strm, offset, @intCast(whence));
    if (pos < 0) return error.Failure;
}

pub fn stat(path: *const String, context: ?*StreamContext, _: std.os.wasi.lookupflags_t, out: *std.os.wasi.filestat_t) !void {
    const p = getStringContent(path);
    var stat_buf: php_h.php_stream_statbuf = undefined;
    const result = php_h._php_stream_stat_path(p.ptr, 0, &stat_buf, context);
    if (result != SUCCESS) return error.Failure;
    copyStat(&stat_buf.sb, out);
}

pub fn fstat(strm: *Stream, out: *std.os.wasi.filestat_t) !void {
    var stat_buf: php_h.php_stream_statbuf = undefined;
    const result = php_h._php_stream_stat(strm, &stat_buf);
    if (result != SUCCESS) return error.Failure;
    copyStat(&stat_buf.sb, out);
}

fn copyStat(in: *php_h.zend_stat_t, out: *std.os.wasi.filestat_t) void {
    out.size = convertSize(in.st_size);
    out.atim = convertTimespec(&in.st_atim);
    out.ctim = convertTimespec(&in.st_ctim);
    out.mtim = convertTimespec(&in.st_mtim);
    out.ino = @intCast(in.st_ino);
    out.dev = @intCast(in.st_dev);
    out.filetype = switch (in.st_mode & php_h.S_IFMT) {
        php_h.S_IFSOCK => .SOCKET_STREAM,
        php_h.S_IFLNK => .SYMBOLIC_LINK,
        php_h.S_IFREG => .REGULAR_FILE,
        php_h.S_IFBLK => .BLOCK_DEVICE,
        php_h.S_IFDIR => .DIRECTORY,
        php_h.S_IFCHR => .CHARACTER_DEVICE,
        else => .UNKNOWN,
    };
}

fn convertSize(value: anytype) usize {
    if (value < 0) return 0;
    return @intCast(value);
}

fn convertTimespec(t: *php_h.timespec) u64 {
    const s: i64 = t.tv_sec;
    if (s < 0) return 0;
    const ns: i64 = t.tv_nsec;
    return @bitCast(s * 1_000_000_000 + ns);
}

pub fn unlink(path: *const String, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const wrapper, const handler = try getStreamWrapper(p, "unlink");
    const result = handler.?(wrapper, p.ptr, 0, context);
    if (result == 0) return error.Failure;
}

pub fn rename(path: *const String, new_path: *const String, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const np = getStringContent(new_path);
    const wrapper, const handler = try getStreamWrapper(p, "rename");
    const new_wrapper, _ = try getStreamWrapper(np, "rename");
    if (wrapper != new_wrapper) return error.Failure;
    if (handler.?(wrapper, p.ptr, np.ptr, 0, context) == 0) return error.Failure;
}

pub fn tell(strm: *Stream) !usize {
    const pos = php_h._php_stream_tell(strm);
    if (pos < 0) return error.Failure;
    return @intCast(pos);
}

pub fn truncate(strm: *Stream, len: u64) !void {
    const result = php_h._php_stream_truncate_set_size(strm, @intCast(len));
    if (result != 0) return error.Failure;
}

pub fn mkdir(path: *const String, mode: u32, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const result = php_h._php_stream_mkdir(p.ptr, @intCast(mode), 0, context);
    if (result == 0) return error.Failure;
}

pub fn rmdir(path: *const String, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const result = php_h._php_stream_rmdir(p.ptr, 0, context);
    if (result == 0) return error.Failure;
}

pub fn opendir(path: *String, options: c_int, context: ?*StreamContext) !*Stream {
    const p = getStringContent(path);
    var strm: ?*Stream = undefined;
    if (php_h.ZEND_DEBUG == 1) {
        const src = @src();
        strm = php_h._php_stream_opendir(p.ptr, options, context, 1, src.file, src.line, src.file, src.line);
    } else {
        strm = php_h._php_stream_opendir(p.ptr, options, context);
    }
    return strm orelse error.Failure;
}

pub fn readdir(strm: *Stream, ent: *DirEntry) bool {
    return php_h._php_stream_readdir(strm, ent) != null;
}

pub fn closedir(strm: *Stream) void {
    _ = php_h.php_stream_closedir(strm);
}

pub fn sendfile(out_strm: *Stream, in_strm: *Stream, offset: ?*i64, len: u32) !u32 {
    var original_pos: i64 = 0;
    var copied: i64 = 0;
    if (offset) |ptr| {
        original_pos = php_h._php_stream_tell(in_strm);
        if (original_pos < 0) return error.Failure;
        const pos = php_h._php_stream_seek(in_strm, ptr.*, php_h.SEEK_SET);
        if (pos < 0) return error.InvalidOffset;
    }
    var buf: [8192]u8 = undefined;
    var remaining = len;
    while (remaining > 0) {
        const bytes_read = php_h._php_stream_read(in_strm, &buf, @min(remaining, buf.len));
        if (bytes_read == 0) break;
        const written = php_h._php_stream_write(out_strm, &buf, @intCast(bytes_read));
        if (written < 0) return error.Failure;
        copied += bytes_read;
        remaining -= @intCast(bytes_read);
    }
    if (offset) |ptr| {
        ptr.* += copied;
        _ = php_h._php_stream_seek(in_strm, original_pos, php_h.SEEK_SET);
    }
    return @intCast(copied);
}

pub fn copyFileRange(in_strm: *Stream, out_strm: *Stream, in_offset: ?*i64, out_offset: ?*i64, len: u64) !u32 {
    var original_in_pos: i64 = 0;
    var original_out_pos: i64 = 0;
    var copied: i64 = 0;
    if (in_offset) |ptr| {
        original_in_pos = php_h._php_stream_tell(in_strm);
        if (original_in_pos < 0) return error.Failure;
        const pos = php_h._php_stream_seek(in_strm, ptr.*, php_h.SEEK_SET);
        if (pos < 0) return error.InvalidOffset;
    }
    if (out_offset) |ptr| {
        original_out_pos = php_h._php_stream_tell(out_strm);
        if (original_out_pos < 0) return error.Failure;
        const pos = php_h._php_stream_seek(out_strm, ptr.*, php_h.SEEK_SET);
        if (pos < 0) return error.InvalidOffset;
    }
    var buf: [8192]u8 = undefined;
    var remaining = len;
    while (remaining > 0) {
        const bytes_read = php_h._php_stream_read(in_strm, &buf, @min(remaining, buf.len));
        if (bytes_read == 0) break;
        const written = php_h._php_stream_write(out_strm, &buf, @intCast(bytes_read));
        if (written < 0) return error.Failure;
        copied += bytes_read;
        remaining -= @intCast(bytes_read);
    }
    if (in_offset) |ptr| {
        ptr.* += copied;
        _ = php_h._php_stream_seek(in_strm, original_in_pos, php_h.SEEK_SET);
    }
    if (out_offset) |ptr| {
        ptr.* += copied;
        _ = php_h._php_stream_seek(out_strm, original_out_pos, php_h.SEEK_SET);
    }
    return @intCast(copied);
}

pub fn resolve(name: []const u8, parent_path: []const u8) !*String {
    return php_h.php_resolve_path(name.ptr, name.len, parent_path.ptr) orelse error.Failure;
}

pub fn rewinddir(strm: *Stream) !void {
    if (php_h.php_stream_rewinddir(strm) < 0) return error.Failure;
}

extern fn get_stream_context(strm: *Stream) ?*StreamContext;
extern fn get_stream_resource(strm: *Stream) *Resource;

pub fn getStreamContext(strm: *Stream) ?*StreamContext {
    return get_stream_context(strm);
}

pub fn getStreamResource(strm: *Stream) *Resource {
    return get_stream_resource(strm);
}

pub fn getStreamWrapperProperty(strm: *Stream, name: []const u8) !*Value {
    const wrapper = get_stream_wrapper_data(strm);
    return try getProperty(wrapper, name);
}

pub fn setBlocking(strm: *Stream, set: bool) !void {
    const id = php_h.PHP_STREAM_OPTION_BLOCKING;
    const value: c_int = if (set) 1 else 0;
    const result = php_h._php_stream_set_option(strm, id, value, null);
    if (result < 0) return error.Failure;
}

pub fn setLock(strm: *Stream, lock_type: c_int) !void {
    const id = php_h.PHP_STREAM_OPTION_LOCKING;
    const result = php_h._php_stream_set_option(strm, id, lock_type, null);
    if (result != SUCCESS) return error.Failure;
}

pub const utimbuf = php_h.utimbuf;

pub fn touch(path: *String, timebuf: *const php_h.utimbuf, context: ?*StreamContext) !void {
    return try setMetadata(path, php_h.PHP_STREAM_META_TOUCH, timebuf, context);
}

fn setMetadata(path: *String, op: c_int, param_ptr: ?*const anyopaque, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const wrapper, const handler = try getStreamWrapper(p, "stream_metadata");
    if (handler.?(wrapper, p.ptr, op, @constCast(param_ptr), context) == 0) return error.Failure;
}

fn getStreamWrapper(path: []const u8, comptime name: []const u8) !std.meta.Tuple(&.{
    *php_h.php_stream_wrapper,
    @FieldType(php_h.php_stream_wrapper_ops, name),
}) {
    const wrapper = php_h.php_stream_locate_url_wrapper(path.ptr, null, 0);
    if (wrapper == null or wrapper.*.wops == null or @field(wrapper.*.wops.*, name) == null) {
        return error.Failure;
    }
    return .{ wrapper, @field(wrapper.*.wops.*, name) };
}

pub const reportWrongParamCount = php_h.zend_wrong_param_count;

pub const infoTableStart = php_h.php_info_print_table_start;
pub const infoTableHeader = php_h.php_info_print_table_header;
pub const infoTableEnd = php_h.php_info_print_table_end;

pub fn createHandlerTable(comptime T: type, comptime offset: comptime_int) ObjectHandlers {
    var handlers: ObjectHandlers = undefined;
    handlers.offset = offset;
    inline for (comptime std.meta.fields(@TypeOf(object_handler_mapping))) |field| {
        const func_name = @field(object_handler_mapping, field.name);
        @field(handlers, field.name) = if (@hasDecl(T, func_name))
            transform(@field(T, func_name))
        else if (@hasField(@TypeOf(std_object_handlers.*), field.name))
            @field(std_object_handlers, field.name)
        else
            null;
    }
    return handlers;
}

pub const object_handler_mapping = .{
    .free_obj = "freeObject",
    .dtor_obj = "destroyObject",
    .clone_obj = "cloneObject",
    .cast_object = "castObject",
    .read_property = "readProperty",
    .write_property = "writeProperty",
    .unset_property = "unsetProperty",
    .has_property = "hasProperty",
    .get_properties = "getProperties",
    .get_properties_for = "getPropertiesFor",
    .get_property_ptr_ptr = "getPropertyPointer",
    .read_dimension = "readElement",
    .write_dimension = "writeElement",
    .unset_dimension = "unsetElement",
    .has_dimension = "hasElement",
    .count_elements = "countElements",
    .get_constructor = "getConstructor",
    .get_method = "getMethod",
    .get_closure = "getClosure",
    .get_class_name = "getClassName",
    .get_debug_info = "getDebugInfo",
    .get_gc = "getGarbageCollection",
    .compare = "compare",
    .do_operation = "doOperation",
};
