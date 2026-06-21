const std = @import("std");
const builtin = @import("builtin");

pub const c = @import("c");
pub const ArgInfo = c.zend_arg_info;
pub const Array = c.zend_array;
pub const ClassEntry = c.zend_class_entry;
pub const CompilerGlobals = c.zend_compiler_globals;
pub const DirEntry = c.php_stream_dirent;
pub const ExecutorGlobals = c.zend_executor_globals;
pub const ExecuteData = c.zend_execute_data;
pub const Fiber = c.zend_fiber;
pub const FiberTransfer = c.zend_fiber_transfer;
pub const Function = c.zend_function;
pub const FunctionInfo = c.zend_internal_function_info;
pub const HashPosition = c.HashPosition;
pub const HashTable = c.HashTable;
pub const IniEntryDef = c.zend_ini_entry_def;
pub const IniEntry = c.zend_ini_entry;
pub const InternalArgInfo = c.zend_internal_arg_info;
pub const Long = c.zend_long;
pub const Object = c.zend_object;
pub const ObjectHandlers = c.zend_object_handlers;
pub const ObjectIterator = c.zend_object_iterator;
pub const ObjectIteratorFunctions = c.zend_object_iterator_funcs;
pub const RefCounted = c.zend_refcounted;
pub const Reference = c.zend_reference;
pub const Resource = c.zend_resource;
pub const Result = c.zend_result;
pub const Stream = c.php_stream;
pub const StreamContext = c.php_stream_context;
pub const String = c.zend_string;
pub const Uchar = c.zend_uchar;
pub const Ulong = c.zend_ulong;
pub const Value = c.zval;
pub const SUCCESS = c.SUCCESS;
pub const FAILURE = c.FAILURE;
pub const BP_VAR_R = c.BP_VAR_R;
pub const BP_VAR_W = c.BP_VAR_W;
pub const BP_VAR_RW = c.BP_VAR_RW;
pub const BP_VAR_IS = c.BP_VAR_IS;
pub const BP_VAR_FUNC_ARG = c.BP_VAR_FUNC_ARG;
pub const BP_VAR_UNSET = c.BP_VAR_UNSET;
pub const MAY_BE_UNDEF = c.MAY_BE_UNDEF;
pub const MAY_BE_NULL = c.MAY_BE_NULL;
pub const MAY_BE_BOOL = c.MAY_BE_BOOL;
pub const MAY_BE_LONG = c.MAY_BE_LONG;
pub const MAY_BE_DOUBLE = c.MAY_BE_DOUBLE;
pub const MAY_BE_STRING = c.MAY_BE_STRING;
pub const MAY_BE_ARRAY = c.MAY_BE_ARRAY;
pub const MAY_BE_OBJECT = c.MAY_BE_OBJECT;
pub const INTERNAL_CLASS = c.ZEND_INTERNAL_CLASS;
pub const USER_CLASS = c.ZEND_USER_CLASS;
pub const INTERNAL_FUNCTION = c.ZEND_INTERNAL_FUNCTION;
pub const USER_FUNCTION = c.ZEND_USER_FUNCTION;
pub const ANON_CLASS = c.ZEND_ACC_ANON_CLASS;
pub const FINAL = c.ZEND_ACC_FINAL;
pub const LINKED = c.ZEND_ACC_LINKED;
pub const NO_DYNAMIC_PROPERTIES = c.ZEND_ACC_NO_DYNAMIC_PROPERTIES;
pub const NOT_SERIALIZABLE = c.ZEND_ACC_NOT_SERIALIZABLE;
pub const RESOLVED_INTERFACES = c.ZEND_ACC_RESOLVED_INTERFACES;
pub const STRICT_TYPES = c.ZEND_ACC_STRICT_TYPES;
pub const utimbuf = c.utimbuf;
pub const reportWrongParamCount = c.zend_wrong_param_count;
pub const INI_USER = c.ZEND_INI_USER;
pub const INI_PERDIR = c.ZEND_INI_PERDIR;
pub const INI_SYSTEM = c.ZEND_INI_SYSTEM;
pub const INI_ALL = c.ZEND_INI_ALL;
pub const displayIniEntries = c.display_ini_entries;

const debug = @import("debug.zig");
const failure = @import("failure.zig");
const fn_transform = @import("zigft/fn-transform.zig");

// on Windows, we link symbols in PHP executable manually
pub const pc = switch (builtin.target.os.tag) {
    .windows => @import("php-c.zig"),
    else => c,
};

// while function pointer dereference automatically, manually linked data variables
// need to be dereference manually
inline fn deref(arg: anytype) switch (builtin.target.os.tag) {
    .windows => @TypeOf(arg.*),
    else => @TypeOf(arg),
} {
    return switch (builtin.target.os.tag) {
        .windows => arg.*,
        else => arg,
    };
}

fn argCount(comptime Func: type) usize {
    return switch (@typeInfo(Func)) {
        .pointer => |pt| argCount(pt.child),
        .@"fn" => @typeInfo(Func).@"fn".params.len,
        else => @compileError("Not a function or function pointer"),
    };
}

pub const FunctionEntry = extern struct {
    // zig_handler for some reason causes a "dependency loop detected" error
    // need to change it to *const anyopaque
    fname: [*c]const u8,
    handler: *const anyopaque,
    arg_info: [*c]const c.zend_internal_arg_info,
    num_args: u32,
    flags: u32,
};
pub const ModuleEntry = extern struct {
    size: c_ushort,
    zend_api: c_uint,
    zend_debug: u8,
    zts: u8,
    ini_entry: [*c]const c.zend_ini_entry,
    deps: [*c]const c.zend_module_dep,
    name: [*c]const u8,
    functions: [*c]const FunctionEntry,
    module_startup_func: ?*const fn (c_int, c_int) callconv(.c) c.zend_result,
    module_shutdown_func: ?*const fn (c_int, c_int) callconv(.c) c.zend_result,
    request_startup_func: ?*const fn (c_int, c_int) callconv(.c) c.zend_result,
    request_shutdown_func: ?*const fn (c_int, c_int) callconv(.c) c.zend_result,
    info_func: ?*const fn ([*c]@This()) callconv(.c) void,
    version: [*c]const u8,
    globals_size: usize,
    globals_ptr: ?*anyopaque,
    globals_ctor: ?*const fn (?*anyopaque) callconv(.c) void,
    globals_dtor: ?*const fn (?*anyopaque) callconv(.c) void,
    post_deactivate_func: ?*const fn () callconv(.c) c.zend_result,
    module_started: c_int,
    type: u8,
    handle: ?*anyopaque,
    module_number: c_int,
    build_id: [*c]const u8,
};
pub const PURPOSE_DEBUG = 0;
pub const PURPOSE_ARRAY_CAST = 1;
pub const PURPOSE_SERIALIZE = 2;
pub const PURPOSE_VAR_EXPORT = 3;
pub const PURPOSE_JSON = 4;
pub const PURPOSE_NON_EXHAUSTIVE_ENUM = 5;

pub const empty_array = &c.zend_empty_array;

pub const empty_value: Value = .{ .u1 = .{ .type_info = c.IS_NULL } };

pub const use_tsrm = false;

pub fn getCompilerGlobals() *const CompilerGlobals {
    if (use_tsrm) {
        @compileError("TODO");
    } else {
        return deref(&pc.compiler_globals);
    }
}

pub fn getExecutorGlobals() *const ExecutorGlobals {
    if (use_tsrm) {
        @compileError("TODO");
    } else {
        return deref(&pc.executor_globals);
    }
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
                    total += getHashLength(arr);
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
        if (getHashLength(ht) == 0) {
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

pub fn findClassEntry(comptime name: []const u8) ?*ClassEntry {
    return pc.zend_lookup_class(getStaticString(name));
}

pub const ValueType = enum(u8) {
    undefined = c.IS_UNDEF, // 0
    null = c.IS_NULL, // 1
    false = c.IS_FALSE, // 2
    true = c.IS_TRUE, // 3
    long = c.IS_LONG, // 4
    double = c.IS_DOUBLE, // 5
    string = c.IS_STRING, // 6
    array = c.IS_ARRAY, // 7
    object = c.IS_OBJECT, // 8
    resource = c.IS_RESOURCE, // 9
    reference = c.IS_REFERENCE, // 10
    constant_ast = c.IS_CONSTANT_AST, // 11
    callable = c.IS_CALLABLE, // 12
    pointer = c.IS_PTR, // 13

    // fake types
    @"error" = c._IS_ERROR, // 15
    boolean = c._IS_BOOL, // 18
    number = c._IS_NUMBER, // 19

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
    return c.GC_INFO(arg) != 0;
}

pub fn isGmpObject(obj: *Object) bool {
    const name_str = obj.ce.*.name orelse return false;
    const name = getStringContent(name_str);
    return std.mem.eql(u8, name, "GMP");
}

pub fn getValueType(value: *const Value) ValueType {
    return @enumFromInt(value.u1.v.type);
}

pub fn createValueNull() Value {
    var result: Value = .{};
    result.u1.type_info = c.IS_NULL;
    return result;
}

pub fn createValueBool(b: bool) Value {
    var result: Value = .{};
    result.u1.type_info = if (b) c.IS_TRUE else c.IS_FALSE;
    return result;
}

pub fn createValueLong(l: Long) Value {
    var result: Value = .{};
    result.value.lval = l;
    result.u1.type_info = c.IS_LONG;
    return result;
}

pub fn createValueAnyInt(i: anytype) Value {
    const T = @TypeOf(i);
    var long: Long = undefined;
    switch (@typeInfo(T)) {
        .int => |int| {
            if (int.signedness == .signed) {
                long = if (int.bits > @bitSizeOf(Long)) @truncate(i) else i;
            } else {
                const ulong: Ulong = if (int.bits > @bitSizeOf(Ulong)) @truncate(i) else i;
                long = @bitCast(ulong);
            }
        },
        .comptime_int => {
            if (i < std.math.minInt(Long) or i > std.math.maxInt(Long)) {
                @compileError("Integer overflow");
            }
            long = i;
        },
        else => @compileError("Not integer"),
    }
    return createValueLong(long);
}

pub fn createValueDouble(d: f64) Value {
    var result: Value = .{};
    result.value.dval = d;
    result.u1.type_info = c.IS_DOUBLE;
    return result;
}

pub fn createValueString(s: *String) Value {
    var result: Value = .{};
    result.value.str = s;
    // non-interned string need to be gc'ed
    result.u1.type_info = switch (s.gc.u.type_info & c.IS_STR_INTERNED) {
        0 => c.IS_STRING_EX,
        else => c.IS_STRING,
    };
    return result;
}

pub fn createValueStringContent(sc: []const u8) Value {
    return createValueString(createString(sc));
}

pub inline fn createValuePersistentString(sc: []const u8) Value {
    return createValueString(getStaticString(sc));
}

pub fn createValueObject(object: ?*Object) Value {
    var result: Value = .{};
    result.value.obj = object orelse createStandardObject();
    result.u1.type_info = c.IS_OBJECT_EX;
    return result;
}

pub fn createValueReference(target: *const Value) Value {
    var result: Value = .{};
    const ref: *Reference = @ptrCast(@alignCast(emalloc(@sizeOf(Reference), @src())));
    ref.gc = .{ .refcount = 1, .u = .{ .type_info = c.GC_REFERENCE } };
    ref.val = target.*;
    ref.sources = .{ .ptr = null };
    result.value.ref = ref;
    result.u1.type_info = c.IS_REFERENCE_EX;
    return result;
}

pub fn createValueNewObject(name: *const String, params: []const Value) !Value {
    var result: Value = undefined;
    const ce = pc.zend_lookup_class(@constCast(name)) orelse return error.NonexistentClass;
    if (pc.object_init_ex(&result, ce) != c.SUCCESS) return error.CannotCreateObject;
    const obj = result.value.obj;
    const ctor = obj.*.handlers.*.get_constructor.?(obj);
    if (ctor) |f| {
        pc.zend_call_known_function(
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
    result.u1.type_info = c.IS_PTR;
    return result;
}

pub fn createValueArray(arr: ?*Array) Value {
    var result: Value = .{};
    result.value.arr = arr orelse createArray();
    result.u1.type_info = c.IS_ARRAY_EX;
    return result;
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

fn StringWithLength(comptime len: usize) type {
    return extern struct {
        gc: c.zend_refcounted_h = undefined,
        h: c.zend_ulong = undefined,
        len: usize = len,
        val: [len + 1]u8 = undefined,
    };
}

pub fn calculateStringHash(s: []const u8) Ulong {
    return c.zend_inline_hash_func(s.ptr, s.len);
}

pub fn getStaticString(comptime s: []const u8) *String {
    const ns = struct {
        // need to use var since PHP will try to set additional flags
        var str: StringWithLength(s.len) = .{
            .gc = .{
                .refcount = 0,
                .u = .{
                    .type_info = c.IS_STRING | c.IS_STR_PERMANENT | c.IS_STR_INTERNED | c.GC_NOT_COLLECTABLE,
                },
            },
            .h = calculateStringHash(s),
            .val = init: {
                var buf: [s.len + 1]u8 = undefined;
                @memcpy(buf[0..s.len], s);
                buf[s.len] = 0;
                break :init buf;
            },
        };
    };
    return @ptrCast(@constCast(&ns.str));
}

extern fn set_zval_stream(*Value, *Stream) void;

pub fn createValueStream(strm: *Stream) Value {
    var result: Value = .{};
    set_zval_stream(&result, strm);
    return result;
}

pub fn createValueClosure(func: *Function, scope: ?*ClassEntry, called_scope: ?*ClassEntry, this_ptr: ?*const Value) Value {
    var result: Value = undefined;
    pc.zend_create_closure(&result, func, scope, called_scope, @constCast(this_ptr));
    return result;
}

pub fn empty(comptime T: type) *T {
    return switch (T) {
        String => pc.zend_empty_string,
        Array => @constCast(&pc.zend_empty_array),
        else => @compileError("No empty version: " ++ @typeName(T)),
    };
}

pub fn convertValue(value: *Value, desired_type: ValueType) !void {
    switch (desired_type) {
        .boolean => pc.convert_to_boolean(value),
        .long => pc.convert_to_long(value),
        .string => pc._convert_to_string(value),
        .array => pc.convert_to_array(value),
        .object => pc.convert_to_object(value),
        .double => pc.convert_to_double(value),
        .null => pc.convert_to_null(value),
        else => return error.Unexpected,
    }
}

pub fn compareValues(a: *const Value, b: *const Value) c_int {
    return pc.zend_compare(@constCast(a), @constCast(b));
}

pub fn isValueNull(value: *const Value) bool {
    return value.u1.v.type == c.IS_NULL;
}

pub fn getValueNull(value: *const Value) !void {
    return switch (value.u1.v.type) {
        c.IS_NULL => {},
        else => error.NotNull,
    };
}

pub fn getValueBool(value: *const Value) !bool {
    return switch (value.u1.v.type) {
        c.IS_TRUE => true,
        c.IS_FALSE => false,
        else => error.NotBoolean,
    };
}

pub fn getValueLong(value: *const Value) !Long {
    return switch (value.u1.v.type) {
        c.IS_LONG => value.value.lval,
        c.IS_STRING => convert: {
            const s: [*c]u8 = &value.value.str.*.val;
            const len = value.value.str.*.len;
            var long: Long = undefined;
            var double: f64 = undefined;
            const result = if (s[0] > '9')
                c.IS_UNDEF
            else
                pc._is_numeric_string_ex(s, len, &long, &double, false, null, null);
            break :convert switch (result) {
                c.IS_LONG => long,
                c.IS_DOUBLE => try doubleToLong(double),
                else => error.NotInteger,
            };
        },
        c.IS_DOUBLE => convert: {
            break :convert try doubleToLong(value.value.dval);
        },
        else => error.NotInteger,
    };
}

fn doubleToLong(value: f64) !Long {
    @setRuntimeSafety(false);
    const long: Long = @intFromFloat(value);
    const double: f64 = @floatFromInt(long);
    return switch (double == value) {
        true => long,
        else => error.NotInteger,
    };
}

pub fn getValueUlong(value: *const Value) !Ulong {
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
        c.IS_DOUBLE => value.value.dval,
        c.IS_STRING => convert: {
            const s: [*c]u8 = &value.value.str.*.val;
            const len = value.value.str.*.len;
            var long: Long = undefined;
            var double: f64 = undefined;
            const result = if (s[0] > '9')
                c.IS_UNDEF
            else
                pc._is_numeric_string_ex(s, len, &long, &double, false, null, null);
            break :convert switch (result) {
                c.IS_DOUBLE => double,
                c.IS_LONG => try longToDouble(long),
                else => error.NotDouble,
            };
        },
        c.IS_LONG => convert: {
            break :convert try longToDouble(value.value.lval);
        },
        else => error.NotDouble,
    };
}

fn longToDouble(value: Long) !f64 {
    @setRuntimeSafety(false);
    const double: f64 = @floatFromInt(value);
    const long: Long = @intFromFloat(double);
    return switch (long == value) {
        true => double,
        else => error.NotDouble,
    };
}

pub fn getValueString(value: *const Value) !*String {
    return switch (value.u1.v.type) {
        c.IS_STRING => value.value.str,
        else => error.NotString,
    };
}

pub fn getValueStringContent(value: *const Value) ![]const u8 {
    return switch (value.u1.v.type) {
        c.IS_STRING => getStringContent(value.value.str),
        else => error.NotString,
    };
}

pub fn getValueArray(value: *const Value) !*Array {
    return switch (value.u1.v.type) {
        c.IS_ARRAY => value.value.arr,
        else => error.NotArray,
    };
}

pub fn getValueStream(value: *const Value) !*Stream {
    if (value.u1.v.type == c.IS_RESOURCE) {
        const res_ptr = pc.zend_fetch_resource2_ex(
            @constCast(value),
            "stream",
            pc.php_file_le_stream(),
            pc.php_file_le_pstream(),
        );
        if (res_ptr) |ptr| return @ptrCast(@alignCast(ptr));
    }
    return error.NotStream;
}

pub fn getValueHashTable(value: *const Value) !*HashTable {
    return switch (value.u1.v.type) {
        c.IS_ARRAY => value.value.arr,
        c.IS_OBJECT => value.value.obj.*.properties orelse error.NotArrayOrObject,
        else => error.NotArrayOrObject,
    };
}

pub fn getValueObject(value: *const Value) !*Object {
    return switch (value.u1.v.type) {
        c.IS_OBJECT => value.value.obj,
        else => error.NotObject,
    };
}

pub fn getValueReference(value: *const Value) !*Reference {
    return switch (value.u1.v.type) {
        c.IS_REFERENCE => value.value.ref,
        else => error.NotReference,
    };
}

pub fn getValuePointer(comptime T: type, value: *const Value) !T {
    return switch (value.u1.v.type) {
        c.IS_PTR => if (value.value.ptr) |p|
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
        0 => deref(pc.zend_empty_string),
        1 => deref(pc.zend_one_char_string)[s[0]],
        else => create: {
            const zs = createStringWithLength(s.len);
            if (s.len > 0) {
                const ds: [*]u8 = @ptrCast(&zs.*.val[0]);
                @memcpy(ds[0..s.len], s);
                ds[s.len] = '\x00';
            }
            break :create zs;
        },
    };
}

pub fn isStringInterned(str: *String) bool {
    return (str.gc.u.type_info & c.IS_STR_INTERNED) != 0;
}

pub fn createStringWithLength(len: usize) *String {
    return switch (len) {
        0 => deref(pc.zend_empty_string),
        else => create: {
            const struct_size = @offsetOf(String, "val") + len + 1;
            const aligned_size = std.mem.alignForward(usize, struct_size, c.ZEND_MM_ALIGNMENT);
            const zs: *String = @ptrCast(@alignCast(emalloc(aligned_size, @src())));
            zs.* = .{
                .gc = .{ .refcount = 1, .u = .{ .type_info = c.GC_STRING } },
                .h = 0,
                .len = len,
            };
            break :create zs;
        },
    };
}

pub fn createInternedString(s: []const u8) *String {
    const zend_string_init_interned = deref(pc.zend_string_init_interned);
    return zend_string_init_interned.?(s.ptr, s.len, false);
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
    const obj = pc.zend_objects_new(getClassEntry(.standard));
    obj.*.properties = pc._zend_new_array_0();
    return obj;
}

pub fn createArray() *Array {
    return pc._zend_new_array_0();
}

pub fn createNonDestructiveArray() *Array {
    const bytes = emalloc(@sizeOf(HashTable), @src());
    const ht: *HashTable = @ptrCast(@alignCast(bytes));
    pc._zend_hash_init(ht, c.HT_MIN_SIZE, null, false);
    return ht;
}

pub fn isNormalArray(ht: *Array) bool {
    return ht.nNumOfElements == ht.nNextFreeElement;
}

pub fn convertIterator(value: *const Value) Value {
    if (getValueType(value) == .object) {
        const obj: *Object = value.value.obj;
        const ce: *ClassEntry = obj.ce;
        if (ce.get_iterator) |get_iterator| {
            if (get_iterator(ce, @constCast(value), 0)) |iter| {
                defer pc.zend_iterator_dtor(iter);
                const new_array = createArray();
                const handlers = iter.*.funcs.?;
                const rewind = handlers.*.rewind.?;
                const valid = handlers.*.valid.?;
                const get_current_data = handlers.*.get_current_data.?;
                const move_forward = handlers.*.move_forward.?;
                rewind(iter);
                while (valid(iter) == SUCCESS) {
                    const element = get_current_data(iter).?;
                    _ = appendHashEntryRef(new_array, element);
                    move_forward(iter);
                }
                return createValueArray(new_array);
            }
        }
    }
    // cannot convert--just return the original value with ref count bumped
    addRef(value);
    return value.*;
}

pub fn getDestructor(comptime tag: enum { function, value }) @TypeOf(switch (tag) {
    .function => deref(&pc.zend_function_dtor),
    .value => deref(&pc.zval_ptr_dtor),
}) {
    return switch (tag) {
        .function => deref(&pc.zend_function_dtor),
        .value => deref(&pc.zval_ptr_dtor),
    };
}

pub fn createHashTable(dtor: c.dtor_func_t) HashTable {
    var result: HashTable = undefined;
    pc._zend_hash_init(&result, c.HT_MIN_SIZE, dtor, false);
    return result;
}

pub fn destroyHashTable(ht: *HashTable) void {
    pc.zend_hash_destroy(ht);
}

pub fn getHashLength(ht: *const HashTable) usize {
    return ht.nNumOfElements;
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
        pc.zend_hash_str_find(ht, key.ptr, key.len) orelse error.Missing
    else if (comptime isString(KT))
        pc.zend_hash_find(ht, @constCast(key)) orelse error.Missing
    else if (comptime isInt(KT))
        pc.zend_hash_index_find(ht, @intCast(key)) orelse error.Missing
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
    ht.*.u.flags |= c.HASH_FLAG_ALLOW_COW_VIOLATION;
    const result = if (comptime isStringContent(KT))
        pc.zend_hash_str_update(ht, key.ptr, key.len, @constCast(value))
    else if (comptime isInt(KT))
        pc.zend_hash_index_update(ht, @intCast(key), @constCast(value))
    else if (comptime isString(KT))
        pc.zend_hash_update(ht, key, @constCast(value))
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
    ht.*.u.flags |= c.HASH_FLAG_ALLOW_COW_VIOLATION;
    _ = pc.zend_hash_next_index_insert(ht, @constCast(value));
    return c.zend_hash_num_elements(ht);
}

pub fn appendHashEntryRef(ht: *HashTable, value: *const Value) usize {
    defer addRef(value);
    return appendHashEntry(ht, value);
}

pub fn removeHashEntry(ht: *HashTable, key: anytype) bool {
    const KT = @TypeOf(key);
    ht.*.u.flags |= c.HASH_FLAG_ALLOW_COW_VIOLATION;
    const result = if (comptime isStringContent(KT))
        pc.zend_hash_str_del(ht, key.ptr, key.len)
    else if (comptime isString(KT))
        pc.zend_hash_del(ht, key)
    else if (comptime isInt(KT))
        pc.zend_hash_index_del(ht, @intCast(key))
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
        pc.zend_hash_str_find(ht, key.ptr, key.len) != null
    else if (comptime isString(KT))
        pc.zend_hash_find(ht, key) != null
    else if (comptime isInt(KT))
        pc.zend_hash_index_find(ht, @intCast(key)) != null
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
            .forward => pc.zend_hash_internal_pointer_reset_ex(nc_ht, &pos),
            .backward => pc.zend_hash_internal_pointer_end_ex(nc_ht, &pos),
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
            .forward => pc.zend_hash_internal_pointer_reset_ex(self.ht, &self.pos),
            .backward => pc.zend_hash_internal_pointer_end_ex(self.ht, &self.pos),
        }
        self.returned = false;
    }

    pub fn next(self: *@This()) ?*Value {
        defer self.returned = true;
        if (self.returned) {
            switch (self.dir) {
                .forward => _ = pc.zend_hash_move_forward_ex(self.ht, &self.pos),
                .backward => _ = pc.zend_hash_move_backwards_ex(self.ht, &self.pos),
            }
        }
        self.key = null;
        return pc.zend_hash_get_current_data_ex(self.ht, &self.pos);
    }

    pub fn currentKey(self: *@This()) *Value {
        if (self.key == null) {
            var key: Value = undefined;
            pc.zend_hash_get_current_key_zval_ex(self.ht, &key, &self.pos);
            self.key = key;
            // don't increment the key's refcount
            if (getValueType(&key) == .string) release(&key);
        }
        return &self.key.?;
    }

    pub fn currentIndex(self: *@This()) ?Long {
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

        pub fn currentIndex(self: *@This()) ?Long {
            return self.iter.currentIndex();
        }

        pub fn currentName(self: *@This()) ?*String {
            return self.iter.currentName();
        }
    };
}

pub fn readObjectProperty(obj: *const Object, name: *const String) Value {
    var value: Value = createValueNull();
    _ = pc.zend_read_property_ex(obj.ce, @constCast(obj), @constCast(name), true, &value);
    return value;
}

pub fn addRef(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, *const Value, [*c]Value => {
            if (value.u1.type_info & c.Z_TYPE_FLAGS_MASK != 0) {
                _ = c.zval_addref_p(@constCast(value));
            }
        },
        *String, [*c]String => {
            _ = c.zend_string_addref(value);
        },
        *Object, [*c]Object, *HashTable, [*c]HashTable, *Resource, [*c]Resource => {
            _ = c.GC_ADDREF(value);
        },
        else => @compileError("Unexpected type: " ++ @typeName(T)),
    }
}

pub fn delRef(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, *const Value, [*c]Value => {
            if (value.u1.type_info & c.Z_TYPE_FLAGS_MASK != 0) {
                _ = c.zval_delref_p(@constCast(value));
            }
        },
        *String, [*c]String, *Object, [*c]Object, *HashTable, [*c]HashTable, *Resource, [*c]Resource => {
            _ = c.GC_DELREF(value);
        },
        else => {},
    }
}

pub fn release(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, *const Value, [*c]Value => pc.zval_ptr_dtor(@constCast(value)),
        *String, [*c]String => pc.zend_string_release(value),
        *Object, [*c]Object => pc.zend_object_release(value),
        *HashTable, [*c]HashTable => pc.zend_hash_release(value),
        *Resource, [*c]Resource => _ = pc.zend_list_delete(value),
        else => @compileError("Unexpected type: " ++ @typeName(T)),
    }
}

pub fn reuse(value: anytype) @TypeOf(value) {
    if (@typeInfo(@TypeOf(value)) == .optional) {
        return if (value) |v| reuse(v) else null;
    }
    addRef(value);
    return value;
}

pub fn isObjectFreed(obj: *Object) bool {
    return (obj.gc.u.type_info & c.IS_OBJ_FREE_CALLED) != 0;
}

pub fn invokeMethod(container: ?*const Value, fn_name: *const Value, arguments: []const Value) !Value {
    return invokeMethodEx(container, fn_name, arguments, null);
}

pub fn invokeMethodEx(container: ?*const Value, fn_name: *const Value, arguments: []const Value, named_params: ?*HashTable) !Value {
    var retval: Value = undefined;
    const args = @constCast(arguments.ptr);
    const len: u32 = @intCast(arguments.len);
    if (pc._call_user_function_impl(@constCast(container), @constCast(fn_name), &retval, len, args, named_params) != c.SUCCESS) {
        return error.Failure;
    }
    if (getValueType(&retval) == .undefined) {
        const eg = getExecutorGlobals();
        if (eg.exception != null) {
            return error.ExceptionThrown;
        }
    }
    return retval;
}

pub fn invokeFunction(comptime name: []const u8, arguments: []const Value) !Value {
    const callable = createValueString(getStaticString(name));
    return try invokeMethod(null, &callable, arguments);
}

pub const FunctionCallCache = struct {
    fci: c.zend_fcall_info,
    fcc: c.zend_fcall_info_cache,

    pub fn init(callable: *const Value) !@This() {
        var fci: c.zend_fcall_info = undefined;
        var fcc: c.zend_fcall_info_cache = undefined;
        fci.retval = null;
        fci.param_count = 0;
        fci.params = null;
        var err_msg: [*c]u8 = undefined;
        const result = pc.zend_fcall_info_init(@constCast(callable), 0, &fci, &fcc, null, &err_msg);
        if (result != SUCCESS) {
            if (err_msg != null) {
                defer efree(err_msg, @src());
                return failure.report("{s}", .{err_msg});
            } else {
                return error.NotCallable;
            }
        }
        return .{ .fci = fci, .fcc = fcc };
    }

    pub fn deinit(self: *@This()) void {
        pc.zend_fcall_info_args_clear(&self.fci, true);
    }

    pub fn argumentInfo(self: *@This()) []c.zend_arg_info {
        const common = &self.fcc.function_handler.*.common;
        return if (common.num_args > 0) common.arg_info[0..common.num_args] else &.{};
    }

    pub fn useNamedArguments(self: *@This(), named_params: ?*HashTable) void {
        self.fci.named_params = named_params;
    }

    pub fn invoke(self: *@This(), args: []const Value) !Value {
        pc.zend_fcall_info_argp(&self.fci, @truncate(args.len), @constCast(args.ptr));
        defer pc.zend_fcall_info_args_clear(&self.fci, false);
        defer self.fci.named_params = null;
        var retval: Value = undefined;
        self.fci.retval = &retval;
        const result = pc.zend_call_function(&self.fci, &self.fcc);
        if (result != SUCCESS) return error.Failure;
        if (getValueType(&retval) == .undefined) {
            const eg = getExecutorGlobals();
            if (eg.exception != null) {
                return error.ExceptionThrown;
            }
        }
        return retval;
    }
};

pub fn MethodCallCaches(comptime names: anytype) type {
    const Entries = init: {
        var fields: [names.len]std.builtin.Type.StructField = undefined;
        inline for (names, 0..) |name, i| {
            fields[i] = .{
                .name = @tagName(name),
                .type = FunctionCallCache,
                .default_value_ptr = null,
                .is_comptime = false,
                .alignment = @alignOf(FunctionCallCache),
            };
        }
        break :init @Type(.{
            .@"struct" = .{
                .layout = .auto,
                .decls = &.{},
                .fields = &fields,
                .is_tuple = false,
            },
        });
    };
    return struct {
        method: Entries,

        pub fn init(context: *const Value) !@This() {
            var entries: Entries = undefined;
            const fields = std.meta.fields(Entries);
            var init_count: usize = 0;
            errdefer {
                inline for (0..fields.len) |i| {
                    if (i == init_count) break;
                    @field(entries, fields[i].name).deinit();
                }
            }
            var ht = createHashTable(null);
            defer destroyHashTable(&ht);
            setHashEntry(&ht, 0, context);
            const callable = createValueArray(&ht);
            inline for (fields) |field| {
                const name = createValueString(getStaticString(field.name));
                setHashEntry(&ht, 1, &name);
                @field(entries, field.name) = try .init(&callable);
                init_count += 1;
            }
            return .{ .method = entries };
        }

        pub fn deinit(self: *@This()) void {
            const fields = std.meta.fields(Entries);
            inline for (fields) |field| @field(self.method, field.name).deinit();
        }
    };
}

pub fn emptyArgInfo(comptime count: usize) []const InternalArgInfo {
    const rem = @rem(count, 8);
    if (rem > 0) {
        const larger = emptyArgInfo(count + (8 - rem));
        return larger[0..count];
    } else {
        const ns = struct {
            const array = init: {
                var buffer: [count]InternalArgInfo = undefined;
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
    func_ptr: c.zif_handler,
    comptime name: []const u8,
    comptime arg_count: usize,
    comptime is_variadic: bool,
) Function {
    return createFunctionEx(func_ptr, getStaticString(name), arg_count, is_variadic);
}

pub fn createFunctionEx(
    func_ptr: c.zif_handler,
    name: ?*String,
    comptime arg_count: usize,
    comptime is_variadic: bool,
) Function {
    const arg_info = emptyArgInfo(arg_count + if (is_variadic) 1 else 0);
    var fn_flags: u32 = c.ZEND_ACC_PUBLIC;
    if (is_variadic) fn_flags |= c.ZEND_ACC_VARIADIC;
    return .{
        .internal_function = .{
            .type = c.ZEND_INTERNAL_FUNCTION,
            .function_name = name orelse getStaticString("fn"),
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
    comptime name: []const u8,
    arg_count: usize,
    is_variadic: bool,
) Function {
    return createFunction(&transform(func), name, arg_count, is_variadic);
}

pub fn destroyFunction(func: *Function) void {
    if (func.internal_function.function_name) |n| release(n);
}

pub fn registerConstant(name: *String, value: *const Value) !void {
    var constant: c.zend_constant = .{
        .name = reuse(name),
        .value = reuse(value).*,
    };
    const result = pc.zend_register_constant(&constant);
    if (result != SUCCESS) return error.Failure;
}

pub fn unregisterConstant(name: *String) void {
    const eg = getExecutorGlobals();
    const ht = eg.zend_constants;
    deleteHashEntry(ht, name);
}

pub fn registerFunction(name: *String, func: *Function) !void {
    const lc_name = createLowercaseName(name);
    defer release(lc_name);
    const cg = getCompilerGlobals();
    const ht = cg.function_table;
    if (hasHashEntry(ht, lc_name)) return error.NameConflict;
    const func_ptr = createValuePointer(func);
    setHashEntry(ht, lc_name, &func_ptr);
}

pub fn unregisterFunction(name: *String) void {
    const lc_name = createLowercaseName(name);
    defer release(lc_name);
    const cg = getCompilerGlobals();
    const ht = cg.function_table;
    deleteHashEntry(ht, lc_name);
}

pub fn registerClass(name: *String, ce: *ClassEntry) !void {
    if (!pc.zend_is_valid_class_name(name)) return error.InvalidName;
    const lc_name = createLowercaseName(name);
    defer release(lc_name);
    const cg = getCompilerGlobals();
    const ht = cg.class_table;
    if (hasHashEntry(ht, lc_name)) return error.NameConflict;
    const ce_ptr = createValuePointer(ce);
    setHashEntry(ht, lc_name, &ce_ptr);
}

pub fn unregisterClass(name: *String) void {
    const lc_name = createLowercaseName(name);
    defer release(lc_name);
    const cg = getCompilerGlobals();
    const ht = cg.class_table;
    deleteHashEntry(ht, lc_name);
}

pub fn createLowercaseName(name: *String) *String {
    const str = createString(getStringContent(name));
    const sc = @constCast(getStringContent(str));
    pc.zend_str_tolower(sc.ptr, sc.len);
    return str;
}

pub fn instanceOf(obj: *Object, ce: *ClassEntry) bool {
    return (obj.ce == ce) or pc.instanceof_function_slow(obj.ce, ce);
}

pub fn subclassOf(subclass: *ClassEntry, ce: *ClassEntry) bool {
    return (subclass == ce) or pc.instanceof_function_slow(subclass, ce);
}

pub fn registerInternalClass(ce: *ClassEntry, parent_ce: *ClassEntry) !*ClassEntry {
    return pc.zend_register_internal_class_ex(ce, parent_ce) orelse error.ClassRegistrationFailure;
}

pub fn registerInternalInterface(ce: *ClassEntry) !*ClassEntry {
    return pc.zend_register_internal_interface(ce) orelse error.ClassRegistrationFailure;
}

pub fn unregisterInternalClass(ce: *ClassEntry) void {
    const cg = getCompilerGlobals();
    const list = cg.class_table;
    const lc_name = pc.zend_string_tolower_ex(ce.name, false);
    defer release(lc_name);
    // the destructor will free the memory
    _ = removeHashEntry(list, lc_name);
}

pub const unregisterInternalInterface = unregisterInternalClass;

pub fn getObjectProperty(obj: *Object, name: *String) ?Value {
    var retval: Value = undefined;
    _ = pc.zend_std_read_property(obj, name, BP_VAR_R, null, &retval);
    return retval;
}

pub fn getObjectPropertySize(ce: *ClassEntry) isize {
    return @bitCast(c.zend_object_properties_size(ce));
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
        .aggregate => deref(pc.zend_ce_aggregate),
        .array_access => deref(pc.zend_ce_arrayaccess),
        .countable => deref(pc.zend_ce_countable),
        .iterator => deref(pc.zend_ce_iterator),
        .serializable => deref(pc.zend_ce_serializable),
        .stringable => deref(pc.zend_ce_stringable),
        .traversable => deref(pc.zend_ce_traversable),
        .throwable => deref(pc.zend_ce_throwable),
    };
    return @ptrCast(ptr);
}

pub const ClassEntryName = enum {
    standard,
    exception,
};

pub fn getClassEntry(ctype: ClassEntryName) *ClassEntry {
    const ptr = switch (ctype) {
        .standard => deref(pc.zend_standard_class_def),
        .exception => deref(pc.zend_ce_exception),
    };
    return @ptrCast(ptr);
}

pub const PropPurpose = enum(c_uint) {
    debug = c.ZEND_PROP_PURPOSE_DEBUG,
    array_cast = c.ZEND_PROP_PURPOSE_ARRAY_CAST,
    serialize = c.ZEND_PROP_PURPOSE_SERIALIZE,
    var_export = c.ZEND_PROP_PURPOSE_VAR_EXPORT,
    json = c.ZEND_PROP_PURPOSE_JSON,

    pub fn fromInt(n: c_uint) !@This() {
        return std.meta.intToEnum(@This(), n);
    }
};

pub fn throwError(err: anytype) void {
    // if an exception has already been thrown then don't do anything
    if (failure.match(err, error.ExceptionThrown)) return;
    const msg = failure.acquireMessage(err);
    defer failure.freeMessage(msg);
    _ = pc.zend_throw_exception_ex(null, 0, "%s (zig)", msg.ptr);
}

pub fn throwException(obj: *Object) error{ExceptionThrown} {
    var value = createValueObject(obj);
    pc.zend_throw_exception_object(&value);
    return error.ExceptionThrown;
}

pub fn isException(obj: *Object) bool {
    return instanceOf(obj, getInterface(.throwable));
}

pub fn getValueException(value: *const Value) !*Object {
    const obj = try getValueObject(value);
    if (!isException(obj)) return error.NotException;
    return obj;
}

pub fn getExceptionMessage(obj: *Object) !Value {
    const context = createValueObject(obj);
    var call_cache: MethodCallCaches(.{.getMessage}) = try .init(&context);
    defer call_cache.deinit();
    return try call_cache.method.getMessage.invoke(&.{});
}

pub fn captureException() !*Object {
    const eg = getExecutorGlobals();
    const ex = eg.exception orelse return error.Unexpected;
    addRef(ex);
    pc.zend_clear_exception();
    return ex;
}

pub fn triggerWarning(err: anytype) void {
    const msg = failure.acquireMessage(err);
    defer failure.freeMessage(msg);
    pc.zend_error(c.E_WARNING, "%s (zig)", msg.ptr);
}

pub fn getCurrentLine() u32 {
    return pc.zend_get_executed_lineno();
}

pub fn getCurrentFile() *String {
    const path = pc.zend_get_executed_filename();
    const len = std.mem.len(path);
    return createString(path[0..len]);
}

pub fn getBacktrace() !*Array {
    const eg = getExecutorGlobals();
    var trace: Value = undefined;
    pc.zend_fetch_debug_backtrace(
        &trace,
        0,
        if (eg.exception_ignore_args) c.DEBUG_BACKTRACE_IGNORE_ARGS else 0,
        0,
    );
    return try getValueArray(&trace);
}

pub fn emalloc(size: usize, comptime src: std.builtin.SourceLocation) ?*anyopaque {
    const ptr = switch (comptime argCount(@TypeOf(pc._emalloc))) {
        5 => pc._emalloc(size, src.file, src.line, null, 0),
        1 => pc._emalloc(size),
        else => @compileError("Unexpected _emalloc argument count"),
    };
    return ptr;
}

pub fn efree(ptr: ?*anyopaque, comptime src: std.builtin.SourceLocation) void {
    switch (comptime argCount(@TypeOf(pc._efree))) {
        5 => pc._efree(ptr, src.file, src.line, null, 0),
        1 => pc._efree(ptr),
        else => @compileError("Unexpected ptr argument count"),
    }
}

pub fn estrdup(s: [*:0]const u8, comptime src: std.builtin.SourceLocation) [*:0]const u8 {
    return switch (comptime argCount(@TypeOf(c.estrdup))) {
        5 => c._estrdup(s, src.file, src.line + 1, null, 0),
        1 => c._estrdup(s),
        else => @compileError("Unexpected _estrdup argument count"),
    };
}

pub fn malloc(size: usize) ?*anyopaque {
    const ptr = pc.__zend_malloc(size);
    return ptr;
}

pub fn free(ptr: ?*anyopaque) void {
    c.free(ptr);
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
        .free = @This().free,
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
        return @ptrCast(emalloc(len, @src()));
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
        efree(memory.ptr, @src());
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
    const src = @src();
    return switch (comptime argCount(@TypeOf(pc._php_stream_open_wrapper_ex))) {
        10 => pc._php_stream_open_wrapper_ex(p.ptr, mode, options, null, context, 1, src.file, src.line, src.file, src.line),
        5 => pc._php_stream_open_wrapper_ex(p.ptr, mode, options, null, context),
        else => @compileError("Unexpected _php_stream_open_wrapper_ex argument count"),
    } orelse error.Failure;
}

extern fn get_stream_path(strm: *Stream) ?[*:0]const u8;
extern fn get_stream_flags(strm: *Stream) u32;
extern fn get_stream_handlers(strm: *Stream) *const c.php_stream_ops;
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

pub fn isStdIOStream(strm: *Stream) bool {
    const ops = get_stream_handlers(strm);
    return ops == deref(&pc.php_stream_stdio_ops);
}

pub fn preserveStream(strm: *Stream) void {
    set_stream_no_close(strm);
}

pub fn openDescriptor(fd: c_int, mode: [*c]const u8) !*Stream {
    const src = @src();
    // arg count varies depending on PHP version and whether debug is enabled
    return switch (comptime argCount(@TypeOf(pc._php_stream_fopen_from_fd))) {
        3 => pc._php_stream_fopen_from_fd(fd, mode, null),
        4 => pc._php_stream_fopen_from_fd(fd, mode, null, false),
        8 => pc._php_stream_fopen_from_fd(fd, mode, null, 1, src.file, src.line, src.file, src.line),
        9 => pc._php_stream_fopen_from_fd(fd, mode, null, 1, src.file, src.line, src.file, src.line, false),
        else => @compileError("Unexpected _php_stream_fopen_from_fd argument count"),
    } orelse error.Failure;
}

pub fn getDescriptor(strm: *Stream) ?c_int {
    if (!isStdIOStream(strm)) return null;
    return inline for (.{ c.PHP_STREAM_AS_FD_FOR_SELECT, c.PHP_STREAM_AS_FD }) |as| {
        var fd: c_int align(@alignOf(*anyopaque)) = undefined;
        if (pc._php_stream_cast(strm, as, @ptrCast(&fd), 0) == SUCCESS) {
            break fd;
        }
    } else null;
}

pub fn pipe(fds: *[2]c_int) c_int {
    if (builtin.target.os.tag == .windows) {
        var read_pipe: c.HANDLE = undefined;
        var write_pipe: c.HANDLE = undefined;
        var security: c.SECURITY_ATTRIBUTES = .{
            .nLength = @sizeOf(c.SECURITY_ATTRIBUTES),
            .lpSecurityDescriptor = null,
            .bInheritHandle = c.TRUE,
        };
        if (c.CreatePipe(&read_pipe, &write_pipe, &security, 0) != c.TRUE) return -1;
        fds[0] = c._open_osfhandle(@bitCast(@intFromPtr(read_pipe)), c._O_RDONLY);
        fds[1] = c._open_osfhandle(@bitCast(@intFromPtr(write_pipe)), 0);
        return 0;
    } else {
        return c.pipe(fds);
    }
}

pub fn close(strm: *Stream) void {
    _ = pc._php_stream_free(strm, c.PHP_STREAM_FREE_CLOSE);
}

pub fn flush(strm: *Stream) void {
    _ = pc._php_stream_flush(strm, 0);
}

pub fn read(strm: *Stream, buf: [*]const u8, size: usize) !usize {
    const r = pc._php_stream_read(strm, @constCast(buf), size);
    if (r < 0) return error.Failure;
    return @intCast(r);
}

pub fn write(strm: *Stream, buf: [*]const u8, size: usize) !usize {
    const w = pc._php_stream_write(strm, buf, size);
    if (w < 0) return error.Failure;
    return @intCast(w);
}

pub fn seek(strm: *Stream, offset: i64, whence: u32) !void {
    const ops = get_stream_handlers(strm);
    const flags = get_stream_flags(strm);
    if (ops.seek == null) return error.Unseekable;
    if (flags & c.PHP_STREAM_FLAG_NO_SEEK != 0) return error.Unseekable;
    const pos = pc._php_stream_seek(strm, offset, @intCast(whence));
    if (pos < 0) return error.Failure;
}

pub fn stat(path: *const String, context: ?*StreamContext, _: std.os.wasi.lookupflags_t, out: *std.os.wasi.filestat_t) !void {
    const p = getStringContent(path);
    var stat_buf: c.php_stream_statbuf = undefined;
    const result = pc._php_stream_stat_path(p.ptr, 0, &stat_buf, context);
    if (result != SUCCESS) return error.Failure;
    copyStat(&stat_buf.sb, out);
}

pub fn fstat(strm: *Stream, out: *std.os.wasi.filestat_t) !void {
    var stat_buf: c.php_stream_statbuf = undefined;
    const result = pc._php_stream_stat(strm, &stat_buf);
    if (result != SUCCESS) return error.Failure;
    copyStat(&stat_buf.sb, out);
}

pub fn performOperation(opcode: c_int, op1: *const Value, op2: *const Value) !Value {
    var value: Value = undefined;
    var result: Result = undefined;
    if (pc.get_unary_op(opcode)) |unary_handler| {
        result = unary_handler(&value, @constCast(op1));
    } else if (pc.get_binary_op(opcode)) |binary_handler| {
        result = binary_handler(&value, @constCast(op1), @constCast(op2));
    } else {
        result = FAILURE;
    }
    return if (result == SUCCESS) value else error.Failure;
}

fn copyStat(in: *c.zend_stat_t, out: *std.os.wasi.filestat_t) void {
    if (@hasField(c.zend_stat_t, "st_atim")) {
        out.size = convertSize(in.st_size);
        out.atim = convertTimespec(in.st_atim);
        out.ctim = convertTimespec(in.st_ctim);
        out.mtim = convertTimespec(in.st_mtim);
        out.ino = @intCast(in.st_ino);
        out.dev = @intCast(in.st_dev);
        out.filetype = switch (in.st_mode & c.S_IFMT) {
            c.S_IFSOCK => .SOCKET_STREAM,
            c.S_IFLNK => .SYMBOLIC_LINK,
            c.S_IFREG => .REGULAR_FILE,
            c.S_IFBLK => .BLOCK_DEVICE,
            c.S_IFDIR => .DIRECTORY,
            c.S_IFCHR => .CHARACTER_DEVICE,
            else => .UNKNOWN,
        };
    } else if (@hasField(c.zend_stat_t, "st_atime")) {
        out.size = convertSize(in.st_size);
        out.atim = convertTimespec(in.st_atime);
        out.ctim = convertTimespec(in.st_ctime);
        out.mtim = convertTimespec(in.st_mtime);
        out.ino = @intCast(in.st_ino);
        out.dev = @intCast(in.st_dev);
        out.filetype = switch (in.st_mode & c.S_IFMT) {
            c.S_IFSOCK => .SOCKET_STREAM,
            c.S_IFLNK => .SYMBOLIC_LINK,
            c.S_IFREG => .REGULAR_FILE,
            c.S_IFBLK => .BLOCK_DEVICE,
            c.S_IFDIR => .DIRECTORY,
            c.S_IFCHR => .CHARACTER_DEVICE,
            else => .UNKNOWN,
        };
    } else {
        @compileError("Unsupported stat struct");
    }
}

fn convertSize(value: anytype) usize {
    if (value < 0) return 0;
    return @intCast(value);
}

fn convertTimespec(value: anytype) u64 {
    const T = @TypeOf(value);
    return switch (@typeInfo(T)) {
        .int => @intCast(value),
        .@"struct" => calc: {
            const s: i64 = value.tv_sec;
            if (s < 0) return 0;
            const ns: i64 = value.tv_nsec;
            break :calc @bitCast(s * 1_000_000_000 + ns);
        },
        else => @compileError("Unknown time format"),
    };
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
    const pos = pc._php_stream_tell(strm);
    if (pos < 0) return error.Failure;
    return @intCast(pos);
}

pub fn truncate(strm: *Stream, len: u64) !void {
    const result = pc._php_stream_truncate_set_size(strm, @intCast(len));
    if (result != 0) return error.Failure;
}

pub fn mkdir(path: *const String, mode: u32, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const result = pc._php_stream_mkdir(p.ptr, @intCast(mode), 0, context);
    if (result == 0) return error.Failure;
}

pub fn rmdir(path: *const String, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const result = pc._php_stream_rmdir(p.ptr, 0, context);
    if (result == 0) return error.Failure;
}

pub fn opendir(path: *String, options: c_int, context: ?*StreamContext) !*Stream {
    const p = getStringContent(path);
    const src = @src();
    return switch (comptime argCount(@TypeOf(c._php_stream_opendir))) {
        8 => pc._php_stream_opendir(p.ptr, options, context, 1, src.file, src.line, src.file, src.line),
        3 => pc._php_stream_opendir(p.ptr, options, context),
        else => @compileError("Unexpected _php_stream_opendir argument count"),
    } orelse error.Failure;
}

pub fn readdir(strm: *Stream, ent: *DirEntry) bool {
    return pc._php_stream_readdir(strm, ent) != null;
}

pub fn closedir(strm: *Stream) void {
    _ = pc.php_stream_free(strm, c.PHP_STREAM_FREE_CLOSE);
}

pub fn sendfile(out_strm: *Stream, in_strm: *Stream, offset: ?*i64, len: u32) !u32 {
    var original_pos: i64 = 0;
    var copied: i64 = 0;
    if (offset) |ptr| {
        original_pos = pc._php_stream_tell(in_strm);
        if (original_pos < 0) return error.Failure;
        const pos = pc._php_stream_seek(in_strm, ptr.*, c.SEEK_SET);
        if (pos < 0) return error.InvalidOffset;
    }
    var buf: [8192]u8 = undefined;
    var remaining = len;
    while (remaining > 0) {
        const bytes_read = pc._php_stream_read(in_strm, &buf, @min(remaining, buf.len));
        if (bytes_read == 0) break;
        const written = pc._php_stream_write(out_strm, &buf, @intCast(bytes_read));
        if (written < 0) return error.Failure;
        copied += bytes_read;
        remaining -= @intCast(bytes_read);
    }
    if (offset) |ptr| {
        ptr.* += copied;
        _ = pc._php_stream_seek(in_strm, original_pos, c.SEEK_SET);
    }
    return @intCast(copied);
}

pub fn copyFileRange(in_strm: *Stream, out_strm: *Stream, in_offset: ?*i64, out_offset: ?*i64, len: u64) !u32 {
    var original_in_pos: i64 = 0;
    var original_out_pos: i64 = 0;
    var copied: i64 = 0;
    if (in_offset) |ptr| {
        original_in_pos = pc._php_stream_tell(in_strm);
        if (original_in_pos < 0) return error.Failure;
        const pos = pc._php_stream_seek(in_strm, ptr.*, c.SEEK_SET);
        if (pos < 0) return error.InvalidOffset;
    }
    if (out_offset) |ptr| {
        original_out_pos = pc._php_stream_tell(out_strm);
        if (original_out_pos < 0) return error.Failure;
        const pos = pc._php_stream_seek(out_strm, ptr.*, c.SEEK_SET);
        if (pos < 0) return error.InvalidOffset;
    }
    var buf: [8192]u8 = undefined;
    var remaining = len;
    while (remaining > 0) {
        const bytes_read = pc._php_stream_read(in_strm, &buf, @min(remaining, buf.len));
        if (bytes_read == 0) break;
        const written = pc._php_stream_write(out_strm, &buf, @intCast(bytes_read));
        if (written < 0) return error.Failure;
        copied += bytes_read;
        remaining -= @intCast(bytes_read);
    }
    if (in_offset) |ptr| {
        ptr.* += copied;
        _ = pc._php_stream_seek(in_strm, original_in_pos, c.SEEK_SET);
    }
    if (out_offset) |ptr| {
        ptr.* += copied;
        _ = pc._php_stream_seek(out_strm, original_out_pos, c.SEEK_SET);
    }
    return @intCast(copied);
}

pub fn resolve(name: []const u8, parent_path: []const u8) !*String {
    return pc.php_resolve_path(name.ptr, name.len, parent_path.ptr) orelse error.Failure;
}

pub fn rewinddir(strm: *Stream) !void {
    if (pc.php_stream_rewinddir(strm) < 0) return error.Failure;
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
    const id = c.PHP_STREAM_OPTION_BLOCKING;
    const value: c_int = if (set) 1 else 0;
    const result = pc._php_stream_set_option(strm, id, value, null);
    if (result < 0) return error.Failure;
}

pub fn setLock(strm: *Stream, lock_type: c_int) !void {
    const id = c.PHP_STREAM_OPTION_LOCKING;
    const result = pc._php_stream_set_option(strm, id, lock_type, null);
    if (result != SUCCESS) return error.Failure;
}

pub fn touch(path: *String, timebuf: *const c.utimbuf, context: ?*StreamContext) !void {
    return try setMetadata(path, c.PHP_STREAM_META_TOUCH, timebuf, context);
}

fn setMetadata(path: *String, op: c_int, param_ptr: ?*const anyopaque, context: ?*StreamContext) !void {
    const p = getStringContent(path);
    const wrapper, const handler = try getStreamWrapper(p, "stream_metadata");
    if (handler.?(wrapper, p.ptr, op, @constCast(param_ptr), context) == 0) return error.Failure;
}

fn getStreamWrapper(path: []const u8, comptime name: []const u8) !std.meta.Tuple(&.{
    *c.php_stream_wrapper,
    @FieldType(c.php_stream_wrapper_ops, name),
}) {
    const wrapper = pc.php_stream_locate_url_wrapper(path.ptr, null, 0);
    if (wrapper == null or wrapper.*.wops == null or @field(wrapper.*.wops.*, name) == null) {
        return error.Failure;
    }
    return .{ wrapper, @field(wrapper.*.wops.*, name) };
}

pub const OnModified = fn (*IniEntry, *String, *anyopaque, *anyopaque, *anyopaque, c_int) c_int;

pub fn createHandlerTable(comptime T: type, comptime offset: comptime_int) ObjectHandlers {
    var handlers: ObjectHandlers = undefined;
    handlers.offset = offset;
    const std_object_handlers = deref(&pc.std_object_handlers);
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

pub fn getStandardObjectHandler(comptime tag: std.meta.FieldEnum(ObjectHandlers)) @FieldType(ObjectHandlers, @tagName(tag)) {
    return @field(deref(&pc.std_object_handlers), @tagName(tag));
}

pub fn initializeClassData(ce: *ClassEntry, nullify_handlers: bool) void {
    pc.zend_initialize_class_data(ce, nullify_handlers);
}

pub fn initializeIterator(iter: *ObjectIterator) void {
    pc.zend_iterator_init(iter);
}

pub fn freeIterator(iter: *ObjectIterator) void {
    pc.zend_iterator_dtor(iter);
}

pub fn initializeStandardObject(obj: *Object, ce: *ClassEntry) void {
    pc.zend_object_std_init(obj, ce);
}

pub fn initializeObjectProperties(obj: *Object, ce: *ClassEntry) void {
    pc.object_properties_init(obj, ce);
}

pub fn traceToString(trace: *HashTable, include_main: bool) *String {
    return pc.zend_trace_to_string(trace, include_main);
}

pub fn registerIniEntries(ini_entry: [*]const IniEntryDef, module_number: c_int) Result {
    return pc.zend_register_ini_entries(ini_entry, module_number);
}

pub fn unregisterIniEntries(module_number: c_int) void {
    pc.zend_unregister_ini_entries(module_number);
}

pub fn onUpdateBool(entry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, mh_arg2: ?*anyopaque, mh_arg3: ?*anyopaque, stage: c_int) callconv(.c) c_int {
    return pc.OnUpdateBool(entry, new_value, mh_arg1, mh_arg2, mh_arg3, stage);
}

pub fn onUpdateLong(entry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, mh_arg2: ?*anyopaque, mh_arg3: ?*anyopaque, stage: c_int) callconv(.c) c_int {
    return pc.OnUpdateLong(entry, new_value, mh_arg1, mh_arg2, mh_arg3, stage);
}

pub fn onUpdateString(entry: [*c]IniEntry, new_value: [*c]String, mh_arg1: ?*anyopaque, mh_arg2: ?*anyopaque, mh_arg3: ?*anyopaque, stage: c_int) callconv(.c) c_int {
    return pc.OnUpdateString(entry, new_value, mh_arg1, mh_arg2, mh_arg3, stage);
}

pub fn infoTableStart() void {
    pc.php_info_print_table_start();
}

pub fn infoTableHeader(columns: anytype) void {
    switch (columns.len) {
        2 => pc.php_info_print_table_header(2, columns[0].ptr, columns[1].ptr),
        else => @compileError("Unsupported column count"),
    }
}

pub fn infoTableEnd() void {
    pc.php_info_print_table_end();
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
