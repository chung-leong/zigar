const std = @import("std");

const fn_transform = @import("zigft/fn-transform.zig");

pub const php_h = @cImport({
    @cInclude("php.h");
});

pub const ArgInfo = php_h.zend_internal_arg_info;
pub const Array = php_h.zend_array;
pub const ClassEntry = php_h.zend_class_entry;
pub const CompilerGlobals = php_h.zend_compiler_globals;
pub const ExecutorGlobals = php_h.zend_executor_globals;
pub const ExecuteData = php_h.zend_execute_data;
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
pub const HashTable = php_h.HashTable;
pub const Object = php_h.zend_object;
pub const ObjectHandlers = php_h.zend_object_handlers;
pub const RefCounted = php_h.zend_refcounted;
pub const String = php_h.zend_string;
pub const Value = php_h.zval;

pub const IS_ALIAS_PTR = php_h.IS_ALIAS_PTR;
pub const IS_ARRAY = php_h.IS_ARRAY;
pub const IS_CALLABLE = php_h.IS_CALLABLE;
pub const IS_CONSTANT_AST = php_h.IS_CONSTANT_AST;
pub const IS_DOUBLE = php_h.IS_DOUBLE;
pub const IS_FALSE = php_h.IS_FALSE;
pub const IS_INDIRECT = php_h.IS_INDIRECT;
pub const IS_ITERABLE = php_h.IS_ITERABLE;
pub const IS_LONG = php_h.IS_LONG;
pub const IS_MIXED = php_h.IS_MIXED;
pub const IS_NEVER = php_h.IS_NEVER;
pub const IS_NULL = php_h.IS_NULL;
pub const IS_OBJECT = php_h.IS_OBJECT;
pub const IS_PTR = php_h.IS_PTR;
pub const IS_REFERENCE = php_h.IS_REFERENCE;
pub const IS_RESOURCE = php_h.IS_RESOURCE;
pub const IS_STATIC = php_h.IS_STATIC;
pub const IS_STRING = php_h.IS_STRING;
pub const IS_TRUE = php_h.IS_TRUE;
pub const IS_UNDEF = php_h.IS_UNDEF;
pub const IS_VOID = php_h.IS_VOID;

pub const IS_STRING_EX = php_h.IS_STRING_EX;
pub const IS_ARRAY_EX = php_h.IS_ARRAY_EX;
pub const IS_OBJECT_EX = php_h.IS_OBJECT_EX;
pub const IS_RESOURCE_EX = php_h.IS_RESOURCE_EX;
pub const IS_REFERENCE_EX = php_h.IS_REFERENCE_EX;
pub const IS_CONSTANT_AST_EX = php_h.IS_CONSTANT_AST_EX;

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

pub const NOT_SERIALIZABLE = php_h.ZEND_ACC_NOT_SERIALIZABLE;
pub const LINKED = php_h.ZEND_ACC_LINKED;

pub const std_object_handlers = &php_h.std_object_handlers;

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
    // var param_types: [len]type = undefined;
    // var param_attrs: [len]std.builtin.Type.Fn.Param.Attributes = undefined;
    // inline for (func_info.params, 0..) |param, i| {
    //     const PT = param.type.?;
    //     param_types[i] = switch (@typeInfo(PT)) {
    //         .pointer => ?PT,
    //         else => PT,
    //     };
    //     param_attrs[i] = .{};
    // }
    // return @Fn(&param_types, &param_attrs, func_info.return_type, .{
    //     .@"callconv" = .c,
    //     .varargs = func_info.is_var_args,
    // });
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
                .error_union => |eu| retval catch |err| {
                    _ = eu;
                    @panic(@errorName(err));
                    // php_h.php_error(php_h.E_ERROR, "Zig error: %s", @errorName(err).ptr);
                    // break :report switch (eu.payload) {
                    //     bool => false,
                    //     void => {},
                    //     else => undefined,
                    // };
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

pub fn addValueRef(value: *Value) u32 {
    if (value.u1.type_info & php_h.Z_TYPE_FLAGS_MASK != 0) {
        php_h.zval_addref_p(value);
    }
    return std.math.minInt(u32);
}

pub fn releaseValue(value: *Value) u32 {
    if (value.u1.type_info & php_h.Z_TYPE_FLAGS_MASK != 0) {
        php_h.zval_delref_p(value);
    }
    return std.math.maxInt(u32);
}

pub fn createValueNull() Value {
    var result: Value = .{};
    result.u1.type_info = IS_NULL;
    return result;
}

pub fn createValueBool(b: bool) Value {
    var result: Value = .{};
    result.u1.type_info = if (b) IS_TRUE else IS_FALSE;
    return result;
}

pub fn createValueLong(l: i64) Value {
    var result: Value = .{};
    result.value.lval = l;
    result.u1.type_info = IS_LONG;
    return result;
}

pub fn createValueDouble(d: f64) Value {
    var result: Value = .{};
    result.value.dval = d;
    result.u1.type_info = IS_DOUBLE;
    return result;
}

pub fn createValueString(s: []const u8) Value {
    var result: Value = .{};
    const str = createString(s);
    result.value.str = str;
    result.u1.type_info = if (str.gc.u.type_info & php_h.Z_TYPE_FLAGS_MASK != 0) IS_STRING_EX else IS_STRING;
    return result;
}

pub fn createValuePersistentString(s: []const u8) Value {
    var result: Value = .{};
    result.value.str = createPersistentString(s);
    result.u1.type_info = IS_STRING;
    return result;
}

pub fn createValuePointer(ptr: ?*anyopaque) Value {
    var result: Value = .{};
    result.value.ptr = ptr;
    result.u1.type_info = IS_PTR;
    return result;
}

pub fn createValueArray() Value {
    var result: Value = .{};
    result.value.arr = createArray();
    result.u1.type_info = IS_ARRAY_EX;
    return result;
}

pub fn getValueBool(value: *const Value) !bool {
    return switch (value.u1.v.type) {
        IS_TRUE => true,
        IS_FALSE => false,
        else => error.NotBoolean,
    };
}

pub fn getValueLong(value: *const Value) !c_long {
    return switch (value.u1.v.type) {
        IS_LONG => value.value.lval,
        else => error.NotInteger,
    };
}

pub fn getValueDouble(value: *const Value) !u64 {
    return switch (value.u1.v.type) {
        IS_DOUBLE => value.value.dval,
        else => error.NotDouble,
    };
}

pub fn getValueString(value: *const Value) !*String {
    return switch (value.u1.v.type) {
        IS_STRING => value.value.str,
        else => error.NotString,
    };
}

pub fn getValueStringContent(value: *const Value) ![]const u8 {
    return switch (value.u1.v.type) {
        IS_STRING => getStringContent(value.value.str),
        else => error.NotString,
    };
}

pub fn getValueArray(value: *const Value) !*Array {
    return switch (value.u1.v.type) {
        IS_ARRAY => value.value.arr,
        else => error.NotArray,
    };
}

pub fn getValueHashTable(value: *const Value) !*HashTable {
    return switch (value.u1.v.type) {
        IS_ARRAY, IS_OBJECT => value.value.arr,
        else => error.NotArrayOrObject,
    };
}

pub fn getProperty(object: *Value, key: anytype) !*Value {
    const ht = try getValueHashTable(object);
    return try getHashTableEntry(ht, key);
}

pub fn setProperty(object: *Value, key: anytype, value: *Value) !void {
    const ht = try getValueHashTable(object);
    try setHashTableEntry(ht, key, value);
}

pub fn deleteProperty(object: *Value, key: anytype) !void {
    const ht = try getValueHashTable(object);
    try deleteHashTableEntry(ht, key);
}

pub fn append(array: *Value, element: *Value) !void {
    const arr = try getValueArray(array);
    appendArray(arr, element);
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

pub fn createInternedString(s: []const u8) *String {
    return php_h.zend_string_init_interned.?(s.ptr, s.len, false);
}

pub fn createPersistentString(s: []const u8) *String {
    return php_h.zend_string_init_interned.?(s.ptr, s.len, true);
}

pub fn getStringContent(str: *String) []const u8 {
    const s: [*]const u8 = @ptrCast(&str.*.val[0]);
    const len = str.*.len;
    return s[0..len];
}

pub fn addStringRef(str: *String) u32 {
    return php_h.zend_string_addref(str);
}

pub fn releaseString(str: *String) void {
    php_h.zend_string_release(str);
}

pub fn createArray() *Array {
    return php_h._zend_new_array_0();
}

pub fn appendArray(arr: *Array, element: *Value) void {
    _ = php_h.zend_hash_next_index_insert(arr, element);
}

pub fn createHashTable() HashTable {
    var result: HashTable = undefined;
    php_h._zend_hash_init(&result, 8, null, false);
    return result;
}

pub fn getHashTableEntry(ht: *const HashTable, key: anytype) !*Value {
    const KT = @TypeOf(key);
    return if (comptime isStringContent(KT))
        php_h.zend_hash_str_find(ht, key.ptr, key.len) orelse error.Missing
    else if (comptime isString(KT))
        php_h.zend_hash_find(ht, key)
    else if (comptime isInt(KT))
        php_h.zend_hash_index_find(ht, @intCast(key)) orelse error.Missing
    else
        @compileError("Invalid key: " ++ @typeName(KT));
}

pub fn setHashTableEntry(ht: *HashTable, key: anytype, value: *Value) !void {
    const KT = @TypeOf(key);
    if (comptime isStringContent(KT))
        _ = php_h.zend_hash_str_add(ht, key.ptr, key.len, value)
    else if (comptime isInt(KT))
        _ = php_h.zend_hash_index_add(ht, @intCast(key), value)
    else if (comptime isString(KT))
        _ = php_h.zend_hash_add(ht, key, value)
    else
        @compileError("Invalid key: " ++ @typeName(KT));
}

pub fn deleteHashTableEntry(ht: *HashTable, key: anytype) !void {
    const KT = @TypeOf(key);
    if (comptime isStringContent(KT))
        _ = php_h.zend_hash_str_del(ht, key.ptr, key.len)
    else if (comptime isString(KT))
        _ = php_h.zend_hash_del(ht, key)
    else if (comptime isInt(KT))
        _ = php_h.zend_hash_index_del(ht, @intCast(key))
    else
        @compileError("Invalid key: " ++ @typeName(KT));
}

pub const initializeStandardObject = php_h.zend_object_std_init;
pub const initializeObjectProperties = php_h.object_properties_init;

pub fn getObjectPropertySize(ce: *ClassEntry) isize {
    return @bitCast(php_h.zend_object_properties_size(ce));
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
        const padded_len = len + @sizeOf(usize) + alignment.toByteUnits() - 1;
        const unaligned_ptr: [*]u8 = @ptrCast(php_h._emalloc(padded_len) orelse return null);
        const unaligned_addr = @intFromPtr(unaligned_ptr);
        const aligned_addr = alignment.forward(unaligned_addr + @sizeOf(usize));
        const aligned_ptr = unaligned_ptr + (aligned_addr - unaligned_addr);
        manualAlignHeader(aligned_ptr).* = unaligned_ptr;
        return aligned_ptr;
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
        php_h._efree(manualAlignHeader(memory.ptr).*);
    }
};

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
