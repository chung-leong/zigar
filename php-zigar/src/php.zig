const std = @import("std");

const fn_transform = @import("zigft/fn-transform.zig");

pub const php_h = @cImport({
    @cInclude("php.h");
    @cInclude("zend_builtin_functions.h");
    @cInclude("zend_exceptions.h");
    @cInclude("zend_interfaces.h");
    @cInclude("ext/standard/info.h");
});

pub const ArgInfo = php_h.zend_internal_arg_info;
pub const Array = php_h.zend_array;
pub const ClassEntry = php_h.zend_class_entry;
pub const CompilerGlobals = php_h.zend_compiler_globals;
pub const ExecutorGlobals = php_h.zend_executor_globals;
pub const ExecuteData = php_h.zend_execute_data;
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
pub const RefCounted = php_h.zend_refcounted;
pub const Result = php_h.zend_result;
pub const String = php_h.zend_string;
pub const Ulong = php_h.zend_ulong;
pub const Value = php_h.zval;

pub const SUCCESS = php_h.SUCCESS;
pub const FAILURE = php_h.FAILURE;

pub const MAY_BE_UNDEF = php_h.MAY_BE_UNDEF;
pub const MAY_BE_NULL = php_h.MAY_BE_NULL;
pub const MAY_BE_BOOL = php_h.MAY_BE_BOOL;
pub const MAY_BE_LONG = php_h.MAY_BE_LONG;
pub const MAY_BE_DOUBLE = php_h.MAY_BE_DOUBLE;
pub const MAY_BE_STRING = php_h.MAY_BE_STRING;
pub const MAY_BE_ARRAY = php_h.MAY_BE_ARRAY;
pub const MAY_BE_OBJECT = php_h.MAY_BE_OBJECT;

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

pub const std_object_handlers = &php_h.std_object_handlers;
pub const empty_array = &php_h.zend_empty_array;

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

pub const ParseOptions = struct {
    quiet: bool = false,
    accept_null: bool = false,
    accept_object: bool = true,
};

pub fn parseArguments(comptime specs: [:0]const u8, arg_ptrs: anytype) !void {
    const AT = @TypeOf(arg_ptrs);
    const is_tuple = switch (@typeInfo(AT)) {
        .@"struct" => |st| st.is_tuple,
        else => false,
    };
    if (!is_tuple) @compileError("Tuple expected");
    const fields = std.meta.fields(AT);
    comptime var new_fields: [fields.len + 2]std.builtin.Type.StructField = undefined;
    new_fields[0] = .{
        .name = "0",
        .type = u32,
        .default_value_ptr = null,
        .is_comptime = false,
        .alignment = @alignOf(u32),
    };
    new_fields[1] = .{
        .name = "1",
        .type = [*c]const u8,
        .default_value_ptr = null,
        .is_comptime = false,
        .alignment = @alignOf([*c]const u8),
    };
    inline for (fields, 0..) |field, i| {
        new_fields[i + 2] = .{
            .name = std.fmt.comptimePrint("{d}", .{i + 2}),
            .type = field.type,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(field.type),
        };
    }
    const NewAT = @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .decls = &.{},
            .fields = &new_fields,
            .is_tuple = true,
        },
    });
    var new_args: NewAT = undefined;
    new_args[0] = fields.len;
    new_args[1] = specs.ptr;
    inline for (arg_ptrs, 0..) |arg, i| {
        new_args[2 + i] = arg;
    }
    const result = @call(.auto, php_h.zend_parse_parameters, new_args);
    if (result != php_h.SUCCESS) return error.UnableToParseArgument;
}

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
    const RT = @typeInfo(FnT).@"fn".return_type.?;
    const PhpRT = @typeInfo(PhpFnT).@"fn".return_type.?;
    const ns = struct {
        fn call(php_args: PhpArgs) PhpRT {
            var args: Args = undefined;
            inline for (php_args, 0..) |php_arg, i| args[i] = switch (@typeInfo(@TypeOf(args[i]))) {
                .pointer => @ptrCast(php_arg.?),
                else => php_arg,
            };
            const retval = @call(.auto, func, args);
            const retval_ne = switch (@typeInfo(RT)) {
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
    };
    return fn_transform.spreadArgs(ns.call, .c);
}

pub const initializeClassData = php_h.zend_initialize_class_data;

const Type = enum(u8) {
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

    pub fn isBool(self: @This()) bool {
        return self == .false or self == .true;
    }

    pub fn isNumber(self: @This()) bool {
        return self == .long or self == .double;
    }
};

pub fn getType(value: *const Value) Type {
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

pub fn createValueStringContent(s: []const u8) Value {
    var result: Value = .{};
    const str = createString(s);
    result.value.str = str;
    // non-interned string need to be gc'ed
    result.u1.type_info = if (str.gc.u.type_info & php_h.Z_TYPE_FLAGS_MASK == 0)
        php_h.IS_STRING_EX
    else
        php_h.IS_STRING;
    return result;
}

pub fn createValueString(s: *String) Value {
    var result: Value = .{};
    result.value.str = s;
    result.u1.type_info = php_h.IS_STRING_EX;
    return result;
}

pub fn createValuePersistentString(s: []const u8) Value {
    var result: Value = .{};
    result.value.str = createPersistentString(s);
    result.u1.type_info = php_h.IS_STRING;
    return result;
}

pub fn createValueObject(object: *Object) Value {
    var result: Value = .{};
    result.value.obj = object;
    result.u1.type_info = php_h.IS_OBJECT_EX;
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

pub const convertValueToString = php_h._convert_to_string;

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
        else => error.NotInteger,
    };
}

pub fn getValueDouble(value: *const Value) !f64 {
    return switch (value.u1.v.type) {
        php_h.IS_DOUBLE => value.value.dval,
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

pub fn getValueHashTable(value: *const Value) !*HashTable {
    return switch (value.u1.v.type) {
        php_h.IS_ARRAY => value.value.arr,
        php_h.IS_OBJECT => value.value.obj.*.properties,
        else => error.NotArrayOrObject,
    };
}

pub fn getValueObject(value: *const Value) !*Object {
    return switch (value.u1.v.type) {
        php_h.IS_OBJECT => value.value.obj,
        else => error.NotObject,
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
    try setHashEntry(ht, key, value);
}

pub fn setPropertyRef(object: *Value, key: anytype, value: *Value) !void {
    try setProperty(object, key, value);
    addRef(value);
}

pub fn deleteProperty(object: *Value, key: anytype) !void {
    const ht = try getValueHashTable(object);
    try deleteHashEntry(ht, key);
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
            if (@intFromPtr(zs) == 0x00007f8beb601c40) @breakpoint();
            const ds: [*]u8 = @ptrCast(&zs.*.val[0]);
            @memcpy(ds[0..s.len], s);
            ds[s.len] = '\x00';
            break :create zs;
        },
    };
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

pub fn useString(str: ?*String, def: []const u8) *String {
    if (str) |s| {
        addRef(s);
        return s;
    } else {
        return createString(def);
    }
}

pub fn useArray(arr: ?*Array) *Array {
    if (arr) |a| {
        addRef(a);
        return a;
    } else {
        return createArray();
    }
}

pub fn createArray() *Array {
    return php_h._zend_new_array_0();
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

pub fn insertHashEntry(ht: *HashTable, key: anytype, value: *Value) !*Value {
    const KT = @TypeOf(key);
    ht.*.u.flags |= php_h.HASH_FLAG_ALLOW_COW_VIOLATION;
    const result = if (comptime isStringContent(KT))
        php_h.zend_hash_str_update(ht, key.ptr, key.len, value)
    else if (comptime isInt(KT))
        php_h.zend_hash_index_update(ht, @intCast(key), value)
    else if (comptime isString(KT))
        php_h.zend_hash_update(ht, key, value)
    else
        @compileError("Invalid key: " ++ @typeName(KT));
    if (result == null) return error.Failure;
    return @ptrCast(result);
}

pub fn setHashEntry(ht: *HashTable, key: anytype, value: *Value) !void {
    _ = try insertHashEntry(ht, key, value);
}

pub fn setHashEntryRef(ht: *HashTable, key: anytype, value: *Value) !void {
    try setHashEntry(ht, key, value);
    addRef(value);
}

pub fn appendHashEntry(ht: *HashTable, value: *Value) *Value {
    ht.*.u.flags |= php_h.HASH_FLAG_ALLOW_COW_VIOLATION;
    return php_h.zend_hash_next_index_insert(ht, value);
}

pub fn removeHashEntry(ht: *HashTable, key: anytype) !bool {
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

pub fn deleteHashEntry(ht: *HashTable, key: anytype) !void {
    _ = try removeHashEntry(ht, key);
}

pub fn initializeHashPosition(ht: *HashTable, pos: *HashPosition) void {
    php_h.zend_hash_internal_pointer_reset_ex(ht, pos);
}

pub fn initializeHashPositionToEnd(ht: *HashTable, pos: *HashPosition) void {
    php_h.zend_hash_internal_pointer_end_ex(ht, pos);
}

pub fn moveHashPositionForward(ht: *HashTable, pos: *HashPosition) bool {
    const result = php_h.zend_hash_move_forward_ex(ht, pos);
    return result == php_h.SUCCESS;
}

pub fn moveHashPositionBackward(ht: *HashTable, pos: *HashPosition) bool {
    const result = php_h.zend_hash_move_backwards_ex(ht, pos);
    return result == php_h.SUCCESS;
}

pub fn getHashPositionValue(ht: *HashTable, pos: *HashPosition) ?*Value {
    return php_h.zend_hash_get_current_data_ex(ht, pos);
}

pub fn getHashPositionPointer(comptime T: type, ht: *HashTable, pos: *HashPosition) !?T {
    const value = getHashPositionValue(ht, pos) orelse return null;
    return try getValuePointer(T, value);
}

pub fn getHashPositionKey(ht: *HashTable, pos: *HashPosition) Value {
    var key: Value = undefined;
    php_h.zend_hash_get_current_key_zval_ex(ht, &key, pos);
    return key;
}

pub fn createObject(ce: *ClassEntry) *Object {
    return php_h.zend_objects_new(ce);
}

pub fn readObjectProperty(obj: *const Object, name: *const String) Value {
    var value: Value = createValueNull();
    _ = php_h.zend_read_property_ex(obj.ce, @constCast(obj), @constCast(name), true, &value);
    return value;
}

pub fn addRef(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, [*c]Value => {
            if (value.u1.type_info & php_h.Z_TYPE_FLAGS_MASK != 0)
                _ = php_h.zval_addref_p(value);
        },
        *String, [*c]String => {
            _ = php_h.zend_string_addref(value);
        },
        *Object, [*c]Object, *HashTable, [*c]HashTable => {
            _ = php_h.GC_ADDREF(value);
        },
        else => @compileError("Unexpected type: " ++ @typeName(T)),
    }
}

pub fn release(value: anytype) void {
    const T = @TypeOf(value);
    switch (T) {
        *Value, [*c]Value => php_h.zval_ptr_dtor(value),
        *String, [*c]String => php_h.zend_string_release(value),
        *Object, [*c]Object => php_h.zend_object_release(value),
        *HashTable, [*c]HashTable => php_h.zend_hash_release(value),
        else => @compileError("Unexpected type: " ++ @typeName(T)),
    }
}

pub fn invokeMethod(obj: *Object, fn_name: []const u8, params: anytype) !Value {
    var callable = createValueArray(null);
    defer release(&callable);
    var obj_value = createValueObject(obj);
    var fn_name_value = createValueStringContent(fn_name);
    try setProperty(&callable, 0, &obj_value);
    try setProperty(&callable, 1, &fn_name_value);
    var args: [params.len]Value = undefined;
    inline for (params, 0..) |param, i| {
        args[i] = param;
    }
    var fci: php_h.zend_fcall_info = .{
        .params = &args,
        .param_count = args.len,
    };
    var fci_cache: php_h.zend_fcall_info_cache = undefined;
    var error_str: [*c]u8 = null;
    if (php_h.zend_fcall_info_init(&callable, 0, &fci, &fci_cache, null, &error_str) != php_h.SUCCESS)
        return error.Failure;
    defer if (error_str != null) efree(error_str);
    var retval: Value = undefined;
    fci.retval = &retval;
    if (php_h.zend_call_function(&fci, &fci_cache) != php_h.SUCCESS)
        return error.Failure;
    return retval;
}

pub fn createFunction(comptime func: anytype, name: []const u8) Function {
    return .{
        .internal_function = .{
            .type = php_h.ZEND_INTERNAL_FUNCTION,
            .function_name = createString(name),
            .handler = &transform(func),
        },
    };
}

pub fn destroyFunction(func: *Function) void {
    release(func.internal_function.function_name);
}

pub const instanceOf = php_h.instanceof_function;
pub const initializeStandardObject = php_h.zend_object_std_init;
pub const initializeObjectProperties = php_h.object_properties_init;
pub const registerInternalClass = php_h.zend_register_internal_class_ex;
pub const traceToString = php_h.zend_trace_to_string;

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

pub fn throwError(err: anytype) void {
    const ES = @TypeOf(err);
    const msg = getErrorMessage(ES, err);
    _ = php_h.zend_throw_exception_ex(null, 0, "%s (zig)", msg.ptr);
}

pub fn throwExceptionFmt(comptime fmt: []const u8, params: anytype) void {
    if (std.fmt.allocPrintSentinel(allocator, fmt, params, 0)) |msg| {
        defer allocator.free(msg);
        _ = php_h.zend_throw_exception(null, msg.ptr, 0);
    } else |err| {
        throwError(err);
    }
}

pub fn throwExceptionObject(obj: *Object) void {
    var value = createValueObject(obj);
    php_h.zend_throw_exception_object(&value);
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

pub const emalloc = php_h._emalloc;
pub const efree = php_h.efree;

pub const null_value: *const Value = &.{
    .value = .{ .lval = 0 },
    .u1 = .{ .type_info = php_h.IS_NULL },
};

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

    fn manualAlignHeader(aligned_ptr: [*]u8) *[*]u8 {
        return @ptrCast(@alignCast(aligned_ptr - @sizeOf(usize)));
    }

    fn alloc(
        _: *anyopaque,
        len: usize,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) ?[*]u8 {
        _ = return_address;
        std.debug.assert(len > 0);
        // Overallocate to account for alignment padding and store the original pointer
        // returned by `malloc` before the aligned address.
        _ = alignment;
        return @ptrCast(emalloc(len));
        // const padded_len = len + @sizeOf(usize) + alignment.toByteUnits() - 1;
        // const unaligned_ptr: [*]u8 = @ptrCast(emalloc(padded_len) orelse return null);
        // const unaligned_addr = @intFromPtr(unaligned_ptr);
        // const aligned_addr = alignment.forward(unaligned_addr + @sizeOf(usize));
        // const aligned_ptr = unaligned_ptr + (aligned_addr - unaligned_addr);
        // manualAlignHeader(aligned_ptr).* = unaligned_ptr;
        // allocation_count += 1;
        // allocated_bytes += @intCast(len);
        // return aligned_ptr;
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
        // efree(manualAlignHeader(memory.ptr).*);
        // allocation_count -= 1;
        // allocated_bytes -= @intCast(memory.len);
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

fn getErrorMessage(comptime ES: type, err: ES) []const u8 {
    @setEvalBranchQuota(2000000);
    return switch (err) {
        inline else => |possible_error| get: {
            const msg = comptime decamelize: {
                const name = @errorName(possible_error);
                var buffer: [name.len * 2]u8 = undefined;
                var len: usize = 0;
                for (name, 0..) |c, i| {
                    const conversion_needed = check: {
                        var needed = false;
                        if (std.ascii.isUpper(c)) {
                            // previous letter is not uppercase
                            if (i == 0 or !std.ascii.isUpper(name[i - 1])) {
                                // next letter is not uppercase
                                if (i == name.len - 1 or !std.ascii.isUpper(name[i + 1])) {
                                    needed = true;
                                }
                            }
                        }
                        break :check needed;
                    };
                    if (conversion_needed) {
                        if (i > 0) {
                            buffer[len] = ' ';
                            len += 1;
                        }
                        buffer[len] = std.ascii.toLower(c);
                        len += 1;
                    } else {
                        buffer[len] = c;
                        len += 1;
                    }
                }
                buffer[len] = 0;
                len += 1;
                var array: [len]u8 = undefined;
                @memcpy(&array, buffer[0..len]);
                break :decamelize array;
            };
            break :get &msg;
        },
    };
}

pub const infoTableStart = php_h.php_info_print_table_start;
pub const infoTableHeader = php_h.php_info_print_table_header;
pub const infoTableEnd = php_h.php_info_print_table_end;
