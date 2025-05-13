const std = @import("std");
const builtin = @import("builtin");
const api_translator = @import("code-gen/api-translator.zig");
const inout = api_translator.inout;
const c = @cImport({
    @cInclude("node_api.h");
});

pub const Error = error{
    InvalidArg,
    ObjectExpected,
    StringExpected,
    NameExpected,
    FunctionExpected,
    NumberExpected,
    BooleanExpected,
    ArrayExpected,
    GenericFailure,
    PendingException,
    Cancelled,
    EscapeCalledTwice,
    HandleScopeMismatch,
    CallbackScopeMismatch,
    QueueFull,
    Closing,
    BigintExpected,
    DateExpected,
    ArraybufferExpected,
    DetachableArraybufferExpected,
    WouldDeadlock,
    NoExternalBuffersAllowed,
    CannotRunJs,
    Unexpected,
};
/// https://nodejs.org/api/n-api.html#napi_env
pub const Env = *@This();
/// https://nodejs.org/api/n-api.html#node_api_nogc_env
pub const NogcEnv = *@This();
/// https://nodejs.org/api/n-api.html#node_api_basic_env
pub const BasicEnv = NogcEnv;
/// https://nodejs.org/api/n-api.html#napi_value
pub const Value = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_ref
pub const Ref = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_handle_scope
pub const HandleScope = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_escapable_handle_scope
pub const EscapableHandleScope = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_callback_info
pub const CallbackInfo = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_deferred
pub const Deferred = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_property_attributes
pub const PropertyAttributes = packed struct(c_uint) {
    writable: bool = false,
    enumerable: bool = false,
    configurable: bool = false,
    _: u7 = 0,
    static: bool = false,
    __: std.meta.Int(.unsigned, @bitSizeOf(c_uint) - 11) = 0,
    
    pub const default: @This() = .{};
    pub const default_method: @This() = .{ .writable = true, .configurable = true };
    pub const default_jsproperty: @This() = .{ .writable = true, .enumerable = true, .configurable = true };
};
/// https://nodejs.org/api/n-api.html#napi_valuetype
pub const Valuetype = enum(c_uint) {
    undefined,
    null,
    boolean,
    number,
    string,
    symbol,
    object,
    function,
    external,
    bigint,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_typedarray_type
pub const TypedarrayType = enum(c_uint) {
    int8_array,
    uint8_array,
    uint8_clamped_array,
    int16_array,
    uint16_array,
    int32_array,
    uint32_array,
    float32_array,
    float64_array,
    bigint64_array,
    biguint64_array,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_status
pub const Status = enum(c_uint) {
    ok,
    invalid_arg,
    object_expected,
    string_expected,
    name_expected,
    function_expected,
    number_expected,
    boolean_expected,
    array_expected,
    generic_failure,
    pending_exception,
    cancelled,
    escape_called_twice,
    handle_scope_mismatch,
    callback_scope_mismatch,
    queue_full,
    closing,
    bigint_expected,
    date_expected,
    arraybuffer_expected,
    detachable_arraybuffer_expected,
    would_deadlock,
    no_external_buffers_allowed,
    cannot_run_js,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_callback
pub const Callback = *const fn (
    *@This(),
    CallbackInfo,
) callconv(.c) Value;
/// https://nodejs.org/api/n-api.html#napi_finalize
pub const Finalize = *const fn (
    *@This(),
    *anyopaque,
    ?*anyopaque,
) callconv(.c) void;
/// https://nodejs.org/api/n-api.html#node_api_nogc_finalize
pub const NogcFinalize = Finalize;
/// https://nodejs.org/api/n-api.html#node_api_basic_finalize
pub const BasicFinalize = NogcFinalize;
/// https://nodejs.org/api/n-api.html#napi_property_descriptor
pub const PropertyDescriptor = extern struct {
    utf8name: [*:0]const u8,
    name: Value,
    method: Callback,
    getter: Callback,
    setter: Callback,
    value: Value,
    attributes: PropertyAttributes,
    data: *anyopaque,
};
/// https://nodejs.org/api/n-api.html#napi_extended_error_info
pub const ExtendedErrorInfo = extern struct {
    error_message: [*:0]const u8,
    engine_reserved: *anyopaque,
    engine_error_code: u32,
    error_code: Status,
};
/// https://nodejs.org/api/n-api.html#napi_key_collection_mode
pub const CollectionMode = enum(c_uint) {
    include_prototypes,
    own_only,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_key_filter
pub const Filter = packed struct(c_uint) {
    writable: bool = false,
    enumerable: bool = false,
    configurable: bool = false,
    skip_strings: bool = false,
    skip_symbols: bool = false,
    _: std.meta.Int(.unsigned, @bitSizeOf(c_uint) - 5) = 0,
    
    pub const all_properties: @This() = .{};
};
/// https://nodejs.org/api/n-api.html#napi_key_conversion
pub const Conversion = enum(c_uint) {
    keep_numbers,
    numbers_to_strings,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_type_tag
pub const TypeTag = extern struct {
    lower: u64,
    upper: u64,
};

/// https://nodejs.org/api/n-api.html#napi_get_last_error_info
pub const getLastErrorInfo: fn (
    env: BasicEnv,
) Error!*const ExtendedErrorInfo = c_to_zig.translate("napi_get_last_error_info", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_undefined
pub const getUndefined: fn (
    env: *@This(),
) Error!Value = c_to_zig.translate("napi_get_undefined", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_null
pub const getNull: fn (
    env: *@This(),
) Error!Value = c_to_zig.translate("napi_get_null", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_global
pub const getGlobal: fn (
    env: *@This(),
) Error!Value = c_to_zig.translate("napi_get_global", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_boolean
pub const getBoolean: fn (
    env: *@This(),
    value: bool,
) Error!Value = c_to_zig.translate("napi_get_boolean", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_object
pub const createObject: fn (
    env: *@This(),
) Error!Value = c_to_zig.translate("napi_create_object", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_array
pub const createArray: fn (
    env: *@This(),
) Error!Value = c_to_zig.translate("napi_create_array", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_array_with_length
pub const createArrayWithLength: fn (
    env: *@This(),
    length: usize,
) Error!Value = c_to_zig.translate("napi_create_array_with_length", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_double
pub const createDouble: fn (
    env: *@This(),
    value: f64,
) Error!Value = c_to_zig.translate("napi_create_double", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_int32
pub const createInt32: fn (
    env: *@This(),
    value: i32,
) Error!Value = c_to_zig.translate("napi_create_int32", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_uint32
pub const createUint32: fn (
    env: *@This(),
    value: u32,
) Error!Value = c_to_zig.translate("napi_create_uint32", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_int64
pub const createInt64: fn (
    env: *@This(),
    value: i64,
) Error!Value = c_to_zig.translate("napi_create_int64", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_string_latin1
pub const createStringLatin1: fn (
    env: *@This(),
    str: []const u8,
) Error!Value = c_to_zig.translateMerge("napi_create_string_latin1", true, false, .{}, &.{
    .{ .ptr_index = 1, .len_index = 2 },
});

/// https://nodejs.org/api/n-api.html#napi_create_string_utf8
pub const createStringUtf8: fn (
    env: *@This(),
    str: []const u8,
) Error!Value = c_to_zig.translateMerge("napi_create_string_utf8", true, false, .{}, &.{
    .{ .ptr_index = 1, .len_index = 2 },
});

/// https://nodejs.org/api/n-api.html#napi_create_string_utf16
pub const createStringUtf16: fn (
    env: *@This(),
    str: []const u16,
) Error!Value = c_to_zig.translateMerge("napi_create_string_utf16", true, false, .{}, &.{
    .{ .ptr_index = 1, .len_index = 2 },
});

/// https://nodejs.org/api/n-api.html#napi_create_symbol
pub const createSymbol: fn (
    env: *@This(),
    description: Value,
) Error!Value = c_to_zig.translate("napi_create_symbol", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_function
pub const createFunction: fn (
    env: *@This(),
    utf8name: ?[]const u8,
    cb: Callback,
    data: ?*anyopaque,
) Error!Value = c_to_zig.translateMerge("napi_create_function", true, false, .{ .@"1" = ?[*:0]const u8, .@"4" = ?*anyopaque }, &.{
    .{ .ptr_index = 1, .len_index = 2 },
});

/// https://nodejs.org/api/n-api.html#napi_create_error
pub const createError: fn (
    env: *@This(),
    code: ?Value,
    msg: Value,
) Error!Value = c_to_zig.translate("napi_create_error", true, false, .{ .@"1" = ?Value });

/// https://nodejs.org/api/n-api.html#napi_create_type_error
pub const createTypeError: fn (
    env: *@This(),
    code: ?Value,
    msg: Value,
) Error!Value = c_to_zig.translate("napi_create_type_error", true, false, .{ .@"1" = ?Value });

/// https://nodejs.org/api/n-api.html#napi_create_range_error
pub const createRangeError: fn (
    env: *@This(),
    code: ?Value,
    msg: Value,
) Error!Value = c_to_zig.translate("napi_create_range_error", true, false, .{ .@"1" = ?Value });

/// https://nodejs.org/api/n-api.html#napi_typeof
pub const typeof: fn (
    env: *@This(),
    value: Value,
) Error!Valuetype = c_to_zig.translate("napi_typeof", true, false, .{ .@"2" = Valuetype });

/// https://nodejs.org/api/n-api.html#napi_get_value_double
pub const getValueDouble: fn (
    env: *@This(),
    value: Value,
) Error!f64 = c_to_zig.translate("napi_get_value_double", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_int32
pub const getValueInt32: fn (
    env: *@This(),
    value: Value,
) Error!i32 = c_to_zig.translate("napi_get_value_int32", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_uint32
pub const getValueUint32: fn (
    env: *@This(),
    value: Value,
) Error!u32 = c_to_zig.translate("napi_get_value_uint32", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_int64
pub const getValueInt64: fn (
    env: *@This(),
    value: Value,
) Error!i64 = c_to_zig.translate("napi_get_value_int64", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_bool
pub const getValueBool: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_get_value_bool", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_string_latin1
pub const getValueStringLatin1: fn (
    env: *@This(),
    value: Value,
    buf: ?[]u8,
) Error!usize = c_to_zig.translateMerge("napi_get_value_string_latin1", true, false, .{}, &.{
    .{ .ptr_index = 2, .len_index = 3 },
});

/// https://nodejs.org/api/n-api.html#napi_get_value_string_utf8
pub const getValueStringUtf8: fn (
    env: *@This(),
    value: Value,
    buf: ?[]u8,
) Error!usize = c_to_zig.translateMerge("napi_get_value_string_utf8", true, false, .{}, &.{
    .{ .ptr_index = 2, .len_index = 3 },
});

/// https://nodejs.org/api/n-api.html#napi_get_value_string_utf16
pub const getValueStringUtf16: fn (
    env: *@This(),
    value: Value,
    buf: ?[]u16,
) Error!usize = c_to_zig.translateMerge("napi_get_value_string_utf16", true, false, .{}, &.{
    .{ .ptr_index = 2, .len_index = 3 },
});

/// https://nodejs.org/api/n-api.html#napi_coerce_to_bool
pub const coerceToBool: fn (
    env: *@This(),
    value: Value,
) Error!Value = c_to_zig.translate("napi_coerce_to_bool", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_coerce_to_number
pub const coerceToNumber: fn (
    env: *@This(),
    value: Value,
) Error!Value = c_to_zig.translate("napi_coerce_to_number", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_coerce_to_object
pub const coerceToObject: fn (
    env: *@This(),
    value: Value,
) Error!Value = c_to_zig.translate("napi_coerce_to_object", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_coerce_to_string
pub const coerceToString: fn (
    env: *@This(),
    value: Value,
) Error!Value = c_to_zig.translate("napi_coerce_to_string", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_prototype
pub const getPrototype: fn (
    env: *@This(),
    object: Value,
) Error!Value = c_to_zig.translate("napi_get_prototype", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_property_names
pub const getPropertyNames: fn (
    env: *@This(),
    object: Value,
) Error!Value = c_to_zig.translate("napi_get_property_names", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_set_property
pub const setProperty: fn (
    env: *@This(),
    object: Value,
    key: Value,
    value: Value,
) Error!void = c_to_zig.translate("napi_set_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_has_property
pub const hasProperty: fn (
    env: *@This(),
    object: Value,
    key: Value,
) Error!bool = c_to_zig.translate("napi_has_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_property
pub const getProperty: fn (
    env: *@This(),
    object: Value,
    key: Value,
) Error!Value = c_to_zig.translate("napi_get_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_delete_property
pub const deleteProperty: fn (
    env: *@This(),
    object: Value,
    key: Value,
) Error!bool = c_to_zig.translate("napi_delete_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_has_own_property
pub const hasOwnProperty: fn (
    env: *@This(),
    object: Value,
    key: Value,
) Error!bool = c_to_zig.translate("napi_has_own_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_set_named_property
pub const setNamedProperty: fn (
    env: *@This(),
    object: Value,
    utf8name: [*:0]const u8,
    value: Value,
) Error!void = c_to_zig.translate("napi_set_named_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_has_named_property
pub const hasNamedProperty: fn (
    env: *@This(),
    object: Value,
    utf8name: [*:0]const u8,
) Error!bool = c_to_zig.translate("napi_has_named_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_named_property
pub const getNamedProperty: fn (
    env: *@This(),
    object: Value,
    utf8name: [*:0]const u8,
) Error!Value = c_to_zig.translate("napi_get_named_property", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_set_element
pub const setElement: fn (
    env: *@This(),
    object: Value,
    index: u32,
    value: Value,
) Error!void = c_to_zig.translate("napi_set_element", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_has_element
pub const hasElement: fn (
    env: *@This(),
    object: Value,
    index: u32,
) Error!bool = c_to_zig.translate("napi_has_element", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_element
pub const getElement: fn (
    env: *@This(),
    object: Value,
    index: u32,
) Error!Value = c_to_zig.translate("napi_get_element", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_delete_element
pub const deleteElement: fn (
    env: *@This(),
    object: Value,
    index: u32,
) Error!bool = c_to_zig.translate("napi_delete_element", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_define_properties
pub const defineProperties: fn (
    env: *@This(),
    object: Value,
    property_count: usize,
    properties: *const PropertyDescriptor,
) Error!void = c_to_zig.translate("napi_define_properties", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_array
pub const isArray: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_array", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_array_length
pub const getArrayLength: fn (
    env: *@This(),
    value: Value,
) Error!u32 = c_to_zig.translate("napi_get_array_length", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_strict_equals
pub const strictEquals: fn (
    env: *@This(),
    lhs: Value,
    rhs: Value,
) Error!bool = c_to_zig.translate("napi_strict_equals", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_call_function
pub const callFunction: fn (
    env: *@This(),
    recv: Value,
    func: Value,
    argv: []const Value,
) Error!Value = c_to_zig.translateMerge("napi_call_function", true, false, .{}, &.{
    .{ .ptr_index = 4, .len_index = 3 },
});

/// https://nodejs.org/api/n-api.html#napi_new_instance
pub const newInstance: fn (
    env: *@This(),
    constructor: Value,
    argv: []const Value,
) Error!Value = c_to_zig.translateMerge("napi_new_instance", true, false, .{}, &.{
    .{ .ptr_index = 3, .len_index = 2 },
});

/// https://nodejs.org/api/n-api.html#napi_instanceof
pub const instanceof: fn (
    env: *@This(),
    object: Value,
    constructor: Value,
) Error!bool = c_to_zig.translate("napi_instanceof", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_cb_info
pub const getCbInfo: fn (
    env: *@This(),
    cbinfo: CallbackInfo,
    argc: *usize,
    argv: [*]Value,
) Error!std.meta.Tuple(&.{ Value, ?*anyopaque }) = c_to_zig.translate("napi_get_cb_info", true, false, .{ .@"3" = inout([*]Value), .@"5" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_get_new_target
pub const getNewTarget: fn (
    env: *@This(),
    cbinfo: CallbackInfo,
) Error!Value = c_to_zig.translate("napi_get_new_target", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_define_class
pub const defineClass: fn (
    env: *@This(),
    utf8name: []const u8,
    constructor: Callback,
    data: ?[]u8,
    properties: *const PropertyDescriptor,
) Error!Value = c_to_zig.translateMerge("napi_define_class", true, false, .{ .@"4" = ?*anyopaque }, &.{
    .{ .ptr_index = 1, .len_index = 2 },
    .{ .ptr_index = 4, .len_index = 5 },
});

/// https://nodejs.org/api/n-api.html#napi_wrap
pub const wrap: fn (
    env: *@This(),
    js_object: Value,
    native_object: *anyopaque,
    finalize_cb: ?BasicFinalize,
    finalize_hint: ?*anyopaque,
) Error!Ref = c_to_zig.translate("napi_wrap", true, false, .{ .@"3" = ?BasicFinalize, .@"4" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_unwrap
pub const unwrap: fn (
    env: *@This(),
    js_object: Value,
) Error!*anyopaque = c_to_zig.translate("napi_unwrap", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_remove_wrap
pub const removeWrap: fn (
    env: *@This(),
    js_object: Value,
) Error!*anyopaque = c_to_zig.translate("napi_remove_wrap", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_external
pub const createExternal: fn (
    env: *@This(),
    data: *anyopaque,
    finalize_cb: ?BasicFinalize,
    finalize_hint: ?*anyopaque,
) Error!Value = c_to_zig.translate("napi_create_external", true, false, .{ .@"2" = ?BasicFinalize, .@"3" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_get_value_external
pub const getValueExternal: fn (
    env: *@This(),
    value: Value,
) Error!*anyopaque = c_to_zig.translate("napi_get_value_external", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_reference
pub const createReference: fn (
    env: *@This(),
    value: Value,
    initial_refcount: u32,
) Error!Ref = c_to_zig.translate("napi_create_reference", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_delete_reference
pub const deleteReference: fn (
    env: *@This(),
    ref: Ref,
) Error!void = c_to_zig.translate("napi_delete_reference", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_reference_ref
pub const referenceRef: fn (
    env: *@This(),
    ref: Ref,
) Error!u32 = c_to_zig.translate("napi_reference_ref", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_reference_unref
pub const referenceUnref: fn (
    env: *@This(),
    ref: Ref,
) Error!u32 = c_to_zig.translate("napi_reference_unref", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_reference_value
pub const getReferenceValue: fn (
    env: *@This(),
    ref: Ref,
) Error!Value = c_to_zig.translate("napi_get_reference_value", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_open_handle_scope
pub const openHandleScope: fn (
    env: *@This(),
) Error!HandleScope = c_to_zig.translate("napi_open_handle_scope", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_close_handle_scope
pub const closeHandleScope: fn (
    env: *@This(),
    scope: HandleScope,
) Error!void = c_to_zig.translate("napi_close_handle_scope", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_open_escapable_handle_scope
pub const openEscapableHandleScope: fn (
    env: *@This(),
) Error!EscapableHandleScope = c_to_zig.translate("napi_open_escapable_handle_scope", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_close_escapable_handle_scope
pub const closeEscapableHandleScope: fn (
    env: *@This(),
    scope: EscapableHandleScope,
) Error!void = c_to_zig.translate("napi_close_escapable_handle_scope", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_escape_handle
pub const escapeHandle: fn (
    env: *@This(),
    scope: EscapableHandleScope,
    escapee: Value,
) Error!Value = c_to_zig.translate("napi_escape_handle", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_throw
pub const throw: fn (
    env: *@This(),
    @"error": Value,
) Error!void = c_to_zig.translate("napi_throw", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_throw_error
pub const throwError: fn (
    env: *@This(),
    code: ?[*:0]const u8,
    msg: [*:0]const u8,
) Error!void = c_to_zig.translate("napi_throw_error", true, false, .{ .@"1" = ?[*:0]const u8 });

/// https://nodejs.org/api/n-api.html#napi_throw_type_error
pub const throwTypeError: fn (
    env: *@This(),
    code: ?[*:0]const u8,
    msg: [*:0]const u8,
) Error!void = c_to_zig.translate("napi_throw_type_error", true, false, .{ .@"1" = ?[*:0]const u8 });

/// https://nodejs.org/api/n-api.html#napi_throw_range_error
pub const throwRangeError: fn (
    env: *@This(),
    code: ?[*:0]const u8,
    msg: [*:0]const u8,
) Error!void = c_to_zig.translate("napi_throw_range_error", true, false, .{ .@"1" = ?[*:0]const u8 });

/// https://nodejs.org/api/n-api.html#napi_is_error
pub const isError: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_error", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_exception_pending
pub const isExceptionPending: fn (
    env: *@This(),
) Error!bool = c_to_zig.translate("napi_is_exception_pending", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_and_clear_last_exception
pub const getAndClearLastException: fn (
    env: *@This(),
) Error!Value = c_to_zig.translate("napi_get_and_clear_last_exception", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_arraybuffer
pub const isArraybuffer: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_arraybuffer", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_arraybuffer
pub const createArraybuffer: fn (
    env: *@This(),
    byte_length: usize,
) Error!std.meta.Tuple(&.{ *anyopaque, Value }) = c_to_zig.translate("napi_create_arraybuffer", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_external_arraybuffer
pub const createExternalArraybuffer: fn (
    env: *@This(),
    external_data: []u8,
    finalize_cb: ?BasicFinalize,
    finalize_hint: ?*anyopaque,
) Error!Value = c_to_zig.translateMerge("napi_create_external_arraybuffer", true, false, .{ .@"3" = ?BasicFinalize, .@"4" = ?*anyopaque }, &.{
    .{ .ptr_index = 1, .len_index = 2 },
});

/// https://nodejs.org/api/n-api.html#napi_get_arraybuffer_info
pub const getArraybufferInfo: fn (
    env: *@This(),
    arraybuffer: Value,
) Error!std.meta.Tuple(&.{ *anyopaque, usize }) = c_to_zig.translate("napi_get_arraybuffer_info", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_typedarray
pub const isTypedarray: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_typedarray", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_typedarray
pub const createTypedarray: fn (
    env: *@This(),
    @"type": TypedarrayType,
    length: usize,
    arraybuffer: Value,
    byte_offset: usize,
) Error!Value = c_to_zig.translate("napi_create_typedarray", true, false, .{ .@"1" = TypedarrayType });

/// https://nodejs.org/api/n-api.html#napi_get_typedarray_info
pub const getTypedarrayInfo: fn (
    env: *@This(),
    typedarray: Value,
) Error!std.meta.Tuple(&.{ TypedarrayType, usize, *anyopaque, Value, usize }) = c_to_zig.translate("napi_get_typedarray_info", true, false, .{ .@"2" = TypedarrayType });

/// https://nodejs.org/api/n-api.html#napi_create_dataview
pub const createDataview: fn (
    env: *@This(),
    length: usize,
    arraybuffer: Value,
    byte_offset: usize,
) Error!Value = c_to_zig.translate("napi_create_dataview", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_dataview
pub const isDataview: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_dataview", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_dataview_info
pub const getDataviewInfo: fn (
    env: *@This(),
    dataview: Value,
) Error!std.meta.Tuple(&.{ usize, *anyopaque, Value, usize }) = c_to_zig.translate("napi_get_dataview_info", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_version
pub const getVersion: fn (
    env: BasicEnv,
) Error!u32 = c_to_zig.translate("napi_get_version", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_promise
pub const createPromise: fn (
    env: *@This(),
) Error!std.meta.Tuple(&.{ Deferred, Value }) = c_to_zig.translate("napi_create_promise", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_resolve_deferred
pub const resolveDeferred: fn (
    env: *@This(),
    deferred: Deferred,
    resolution: Value,
) Error!void = c_to_zig.translate("napi_resolve_deferred", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_reject_deferred
pub const rejectDeferred: fn (
    env: *@This(),
    deferred: Deferred,
    rejection: Value,
) Error!void = c_to_zig.translate("napi_reject_deferred", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_promise
pub const isPromise: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_promise", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_run_script
pub const runScript: fn (
    env: *@This(),
    script: Value,
) Error!Value = c_to_zig.translate("napi_run_script", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_adjust_external_memory
pub const adjustExternalMemory: fn (
    env: BasicEnv,
    change_in_bytes: i64,
) Error!i64 = c_to_zig.translate("napi_adjust_external_memory", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_date
pub const createDate: fn (
    env: *@This(),
    time: f64,
) Error!Value = c_to_zig.translate("napi_create_date", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_date
pub const isDate: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_date", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_date_value
pub const getDateValue: fn (
    env: *@This(),
    value: Value,
) Error!f64 = c_to_zig.translate("napi_get_date_value", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_add_finalizer
pub const addFinalizer: fn (
    env: *@This(),
    js_object: Value,
    finalize_data: *anyopaque,
    finalize_cb: BasicFinalize,
    finalize_hint: ?*anyopaque,
    result: ?*Ref,
) Error!void = c_to_zig.translate("napi_add_finalizer", true, false, .{ .@"4" = ?*anyopaque, .@"5" = inout(?*Ref) });

/// https://nodejs.org/api/n-api.html#napi_create_bigint_int64
pub const createBigintInt64: fn (
    env: *@This(),
    value: i64,
) Error!Value = c_to_zig.translate("napi_create_bigint_int64", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_bigint_uint64
pub const createBigintUint64: fn (
    env: *@This(),
    value: u64,
) Error!Value = c_to_zig.translate("napi_create_bigint_uint64", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_bigint_words
pub const createBigintWords: fn (
    env: *@This(),
    sign_bit: c_int,
    word_count: usize,
    words: *const u64,
) Error!Value = c_to_zig.translate("napi_create_bigint_words", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_bigint_int64
pub const getValueBigintInt64: fn (
    env: *@This(),
    value: Value,
) Error!std.meta.Tuple(&.{ i64, bool }) = c_to_zig.translate("napi_get_value_bigint_int64", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_bigint_uint64
pub const getValueBigintUint64: fn (
    env: *@This(),
    value: Value,
) Error!std.meta.Tuple(&.{ u64, bool }) = c_to_zig.translate("napi_get_value_bigint_uint64", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_value_bigint_words
pub const getValueBigintWords: fn (
    env: *@This(),
    value: Value,
) Error!std.meta.Tuple(&.{ c_int, usize, u64 }) = c_to_zig.translate("napi_get_value_bigint_words", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_all_property_names
pub const getAllPropertyNames: fn (
    env: *@This(),
    object: Value,
    key_mode: CollectionMode,
    key_filter: Filter,
    key_conversion: Conversion,
) Error!Value = c_to_zig.translate("napi_get_all_property_names", true, false, .{ .@"2" = CollectionMode, .@"3" = Filter, .@"4" = Conversion });

/// https://nodejs.org/api/n-api.html#napi_set_instance_data
pub const setInstanceData: fn (
    env: BasicEnv,
    data: *anyopaque,
    finalize_cb: Finalize,
    finalize_hint: ?*anyopaque,
) Error!void = c_to_zig.translate("napi_set_instance_data", true, false, .{ .@"3" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_get_instance_data
pub const getInstanceData: fn (
    env: BasicEnv,
) Error!*anyopaque = c_to_zig.translate("napi_get_instance_data", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_detach_arraybuffer
pub const detachArraybuffer: fn (
    env: *@This(),
    arraybuffer: Value,
) Error!void = c_to_zig.translate("napi_detach_arraybuffer", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_is_detached_arraybuffer
pub const isDetachedArraybuffer: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_detached_arraybuffer", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_type_tag_object
pub const typeTagObject: fn (
    env: *@This(),
    value: Value,
    type_tag: *const TypeTag,
) Error!void = c_to_zig.translate("napi_type_tag_object", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_check_object_type_tag
pub const checkObjectTypeTag: fn (
    env: *@This(),
    value: Value,
    type_tag: *const TypeTag,
) Error!bool = c_to_zig.translate("napi_check_object_type_tag", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_object_freeze
pub const objectFreeze: fn (
    env: *@This(),
    object: Value,
) Error!void = c_to_zig.translate("napi_object_freeze", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_object_seal
pub const objectSeal: fn (
    env: *@This(),
    object: Value,
) Error!void = c_to_zig.translate("napi_object_seal", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_callback_scope
pub const CallbackScope = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_async_context
pub const AsyncContext = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_async_work
pub const AsyncWork = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_cleanup_hook
pub const CleanupHook = *const fn (
    ?*anyopaque,
) callconv(.c) void;
/// https://nodejs.org/api/n-api.html#napi_threadsafe_function
pub const ThreadsafeFunction = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_threadsafe_function_release_mode
pub const ThreadsafeFunctionReleaseMode = enum(c_uint) {
    release,
    abort,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_threadsafe_function_call_mode
pub const ThreadsafeFunctionCallMode = enum(c_uint) {
    nonblocking,
    blocking,
    _,
};
/// https://nodejs.org/api/n-api.html#napi_async_execute_callback
pub const AsyncExecuteCallback = *const fn (
    *@This(),
    *anyopaque,
) callconv(.c) void;
/// https://nodejs.org/api/n-api.html#napi_async_complete_callback
pub const AsyncCompleteCallback = *const fn (
    *@This(),
    Status,
    *anyopaque,
) callconv(.c) void;
/// https://nodejs.org/api/n-api.html#napi_threadsafe_function_call_js
pub const ThreadsafeFunctionCallJs = *const fn (
    *@This(),
    Value,
    ?*anyopaque,
    ?*anyopaque,
) callconv(.c) void;
/// https://nodejs.org/api/n-api.html#napi_node_version
pub const NodeVersion = extern struct {
    major: u32,
    minor: u32,
    patch: u32,
    release: [*:0]const u8,
};
/// https://nodejs.org/api/n-api.html#napi_async_cleanup_hook_handle
pub const AsyncCleanupHookHandle = *opaque {};
/// https://nodejs.org/api/n-api.html#napi_async_cleanup_hook
pub const AsyncCleanupHook = *const fn (
    AsyncCleanupHookHandle,
    ?*anyopaque,
) callconv(.c) void;
/// https://nodejs.org/api/n-api.html#napi_addon_register_func
pub const AddonRegisterFunc = *const fn (
    *@This(),
    Value,
) callconv(.c) Value;
/// https://nodejs.org/api/n-api.html#node_api_addon_get_api_version_func
pub const AddonGetApiVersionFunc = *const fn () callconv(.c) i32;
/// https://nodejs.org/api/n-api.html#napi_module
pub const Module = extern struct {
    nm_version: c_int,
    nm_flags: c_uint,
    nm_filename: [*:0]const u8,
    nm_register_func: AddonRegisterFunc,
    nm_modname: [*:0]const u8,
    nm_priv: *anyopaque,
    reserved: [4]?*anyopaque,
};

/// https://nodejs.org/api/n-api.html#napi_module_register
pub const moduleRegister: fn (
    mod: *Module,
) void = c_to_zig.translate("napi_module_register", false, false, .{ .@"0" = inout(*Module) });

/// https://nodejs.org/api/n-api.html#napi_fatal_error
pub const fatalError: fn (
    location: ?[]const u8,
    message: []const u8,
) noreturn = c_to_zig.translateMerge("napi_fatal_error", false, false, .{ .@"0" = ?[*:0]const u8 }, &.{
    .{ .ptr_index = 0, .len_index = 1 },
    .{ .ptr_index = 2, .len_index = 3 },
});

/// https://nodejs.org/api/n-api.html#napi_async_init
pub const asyncInit: fn (
    env: *@This(),
    async_resource: Value,
    async_resource_name: Value,
) Error!AsyncContext = c_to_zig.translate("napi_async_init", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_async_destroy
pub const asyncDestroy: fn (
    env: *@This(),
    async_context: AsyncContext,
) Error!void = c_to_zig.translate("napi_async_destroy", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_make_callback
pub const makeCallback: fn (
    env: *@This(),
    async_context: AsyncContext,
    recv: Value,
    func: Value,
    argv: []const Value,
) Error!Value = c_to_zig.translateMerge("napi_make_callback", true, false, .{}, &.{
    .{ .ptr_index = 5, .len_index = 4 },
});

/// https://nodejs.org/api/n-api.html#napi_create_buffer
pub const createBuffer: fn (
    env: *@This(),
    length: usize,
) Error!std.meta.Tuple(&.{ *anyopaque, Value }) = c_to_zig.translate("napi_create_buffer", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_external_buffer
pub const createExternalBuffer: fn (
    env: *@This(),
    data: []u8,
    finalize_cb: BasicFinalize,
    finalize_hint: ?*anyopaque,
) Error!Value = c_to_zig.translateMerge("napi_create_external_buffer", true, false, .{ .@"4" = ?*anyopaque }, &.{
    .{ .ptr_index = 2, .len_index = 1 },
});

/// https://nodejs.org/api/n-api.html#napi_create_buffer_copy
pub const createBufferCopy: fn (
    env: *@This(),
    data: []const u8,
) Error!std.meta.Tuple(&.{ *anyopaque, Value }) = c_to_zig.translateMerge("napi_create_buffer_copy", true, false, .{}, &.{
    .{ .ptr_index = 2, .len_index = 1 },
});

/// https://nodejs.org/api/n-api.html#napi_is_buffer
pub const isBuffer: fn (
    env: *@This(),
    value: Value,
) Error!bool = c_to_zig.translate("napi_is_buffer", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_buffer_info
pub const getBufferInfo: fn (
    env: *@This(),
    value: Value,
) Error!std.meta.Tuple(&.{ *anyopaque, usize }) = c_to_zig.translate("napi_get_buffer_info", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_async_work
pub const createAsyncWork: fn (
    env: *@This(),
    async_resource: Value,
    async_resource_name: Value,
    execute: AsyncExecuteCallback,
    complete: AsyncCompleteCallback,
    data: *anyopaque,
) Error!AsyncWork = c_to_zig.translate("napi_create_async_work", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_delete_async_work
pub const deleteAsyncWork: fn (
    env: *@This(),
    work: AsyncWork,
) Error!void = c_to_zig.translate("napi_delete_async_work", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_queue_async_work
pub const queueAsyncWork: fn (
    env: BasicEnv,
    work: AsyncWork,
) Error!void = c_to_zig.translate("napi_queue_async_work", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_cancel_async_work
pub const cancelAsyncWork: fn (
    env: BasicEnv,
    work: AsyncWork,
) Error!void = c_to_zig.translate("napi_cancel_async_work", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_node_version
pub const getNodeVersion: fn (
    env: BasicEnv,
) Error!*const NodeVersion = c_to_zig.translate("napi_get_node_version", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_get_uv_event_loop
pub const getUvEventLoop: fn (
    env: BasicEnv,
) Error!*Anonymous0000 = c_to_zig.translate("napi_get_uv_event_loop", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_fatal_exception
pub const fatalException: fn (
    env: *@This(),
    err: Value,
) Error!void = c_to_zig.translate("napi_fatal_exception", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_add_env_cleanup_hook
pub const addEnvCleanupHook: fn (
    env: BasicEnv,
    fun: CleanupHook,
    arg: ?*anyopaque,
) Error!void = c_to_zig.translate("napi_add_env_cleanup_hook", true, false, .{ .@"2" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_remove_env_cleanup_hook
pub const removeEnvCleanupHook: fn (
    env: BasicEnv,
    fun: CleanupHook,
    arg: ?*anyopaque,
) Error!void = c_to_zig.translate("napi_remove_env_cleanup_hook", true, false, .{ .@"2" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_open_callback_scope
pub const openCallbackScope: fn (
    env: *@This(),
    resource_object: Value,
    context: AsyncContext,
) Error!CallbackScope = c_to_zig.translate("napi_open_callback_scope", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_close_callback_scope
pub const closeCallbackScope: fn (
    env: *@This(),
    scope: CallbackScope,
) Error!void = c_to_zig.translate("napi_close_callback_scope", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_create_threadsafe_function
pub const createThreadsafeFunction: fn (
    env: *@This(),
    func: ?Value,
    async_resource: ?Value,
    async_resource_name: Value,
    max_queue_size: usize,
    initial_thread_count: usize,
    thread_finalize_data: ?*anyopaque,
    thread_finalize_cb: ?Finalize,
    context: ?*anyopaque,
    call_js_cb: ?ThreadsafeFunctionCallJs,
) Error!ThreadsafeFunction = c_to_zig.translate("napi_create_threadsafe_function", true, false, .{ .@"1" = ?Value, .@"2" = ?Value, .@"6" = ?*anyopaque, .@"7" = ?Finalize, .@"8" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_get_threadsafe_function_context
pub const getThreadsafeFunctionContext: fn (
    func: ThreadsafeFunction,
) Error!*anyopaque = c_to_zig.translate("napi_get_threadsafe_function_context", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_call_threadsafe_function
pub const callThreadsafeFunction: fn (
    func: ThreadsafeFunction,
    data: ?*anyopaque,
    is_blocking: ThreadsafeFunctionCallMode,
) Error!void = c_to_zig.translate("napi_call_threadsafe_function", true, false, .{ .@"1" = ?*anyopaque, .@"2" = ThreadsafeFunctionCallMode });

/// https://nodejs.org/api/n-api.html#napi_acquire_threadsafe_function
pub const acquireThreadsafeFunction: fn (
    func: ThreadsafeFunction,
) Error!void = c_to_zig.translate("napi_acquire_threadsafe_function", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_release_threadsafe_function
pub const releaseThreadsafeFunction: fn (
    func: ThreadsafeFunction,
    mode: ThreadsafeFunctionReleaseMode,
) Error!void = c_to_zig.translate("napi_release_threadsafe_function", true, false, .{ .@"1" = ThreadsafeFunctionReleaseMode });

/// https://nodejs.org/api/n-api.html#napi_unref_threadsafe_function
pub const unrefThreadsafeFunction: fn (
    env: BasicEnv,
    func: ThreadsafeFunction,
) Error!void = c_to_zig.translate("napi_unref_threadsafe_function", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_ref_threadsafe_function
pub const refThreadsafeFunction: fn (
    env: BasicEnv,
    func: ThreadsafeFunction,
) Error!void = c_to_zig.translate("napi_ref_threadsafe_function", true, false, .{});

/// https://nodejs.org/api/n-api.html#napi_add_async_cleanup_hook
pub const addAsyncCleanupHook: fn (
    env: BasicEnv,
    hook: AsyncCleanupHook,
    arg: ?*anyopaque,
) Error!AsyncCleanupHookHandle = c_to_zig.translate("napi_add_async_cleanup_hook", true, false, .{ .@"2" = ?*anyopaque });

/// https://nodejs.org/api/n-api.html#napi_remove_async_cleanup_hook
pub const removeAsyncCleanupHook: fn (
    remove_handle: AsyncCleanupHookHandle,
) Error!void = c_to_zig.translate("napi_remove_async_cleanup_hook", true, false, .{});

const Anonymous0000 = opaque {};
const c_to_zig = api_translator.Translator(.{
    .c_import_ns = c,
    .substitutions = &.{
        .{ .old = ?*anyopaque, .new = *anyopaque },
        .{ .old = ?*c.struct_uv_loop_s, .new = *Anonymous0000 },
        .{ .old = ?*const anyopaque, .new = *const anyopaque },
        .{ .old = [*c]c.char16_t, .new = ?[*:0]u16 },
        .{ .old = [*c]const c.char16_t, .new = [*:0]const u16 },
        .{ .old = [*c]const c.napi_extended_error_info, .new = *const ExtendedErrorInfo },
        .{ .old = [*c]const c.napi_node_version, .new = *const NodeVersion },
        .{ .old = [*c]const c.napi_property_descriptor, .new = *const PropertyDescriptor },
        .{ .old = [*c]const c.napi_type_tag, .new = *const TypeTag },
        .{ .old = [*c]const c.napi_value, .new = [*]const Value },
        .{ .old = [*c]const u64, .new = *const u64 },
        .{ .old = [*c]const u8, .new = [*:0]const u8 },
        .{ .old = [*c]u8, .new = ?[*:0]u8 },
        .{ .old = [*c]usize, .new = *usize },
        .{ .old = c.napi_async_cleanup_hook, .new = AsyncCleanupHook },
        .{ .old = c.napi_async_cleanup_hook_handle, .new = AsyncCleanupHookHandle },
        .{ .old = c.napi_async_complete_callback, .new = AsyncCompleteCallback },
        .{ .old = c.napi_async_context, .new = AsyncContext },
        .{ .old = c.napi_async_execute_callback, .new = AsyncExecuteCallback },
        .{ .old = c.napi_async_work, .new = AsyncWork },
        .{ .old = c.napi_callback, .new = Callback },
        .{ .old = c.napi_callback_info, .new = CallbackInfo },
        .{ .old = c.napi_callback_scope, .new = CallbackScope },
        .{ .old = c.napi_cleanup_hook, .new = CleanupHook },
        .{ .old = c.napi_deferred, .new = Deferred },
        .{ .old = c.napi_env, .new = *@This() },
        .{ .old = c.napi_escapable_handle_scope, .new = EscapableHandleScope },
        .{ .old = c.napi_finalize, .new = Finalize },
        .{ .old = c.napi_handle_scope, .new = HandleScope },
        .{ .old = c.napi_ref, .new = Ref },
        .{ .old = c.napi_threadsafe_function, .new = ThreadsafeFunction },
        .{ .old = c.napi_threadsafe_function_call_js, .new = ?ThreadsafeFunctionCallJs },
        .{ .old = c.napi_value, .new = Value },
    },
    .error_scheme = api_translator.BasicErrorScheme(Status, Error, Error.Unexpected),
    .late_bind_fn = late_binder,
});

test {
    inline for (comptime std.meta.declarations(@This())) |decl| {
        _ = @field(@This(), decl.name);
    }
}

pub const version = c.NAPI_VERSION;

pub fn createAddon(comptime attachExports: anytype) void {
    _ = struct {
        export fn node_api_module_get_api_version_v1() i32 {
            return version;
        }

        export fn napi_register_module_v1(env: Env, exports: Value) ?Value {
            attachExports(env, exports) catch |err| {
                std.debug.print("Unable to register Node API module: {s}", .{getErrorMessage(err)});
            };
            return null;
        }
    };
}

pub fn createUsize(
    self: *@This(),
    value: usize,
) Error!Value {
    return switch (@bitSizeOf(usize)) {
        32 => try self.createUint32(value),
        64 => try self.createBigintUint64(value),
        else => @compileError("Unexpected size"),
    };
}

pub fn getValueUsize(
    self: *@This(),
    value: Value,
) Error!usize {
    return switch (@bitSizeOf(usize)) {
        32 => try self.getValueUint32(value),
        64 => (try self.getValueBigintUint64(value))[0],
        else => @compileError("Unexpected size"),
    };
}

pub fn createCallback(
    self: *@This(),
    utf8name: ?[]const u8,
    comptime func: anytype,
    comptime need_this: bool,
    data: ?*anyopaque,
) Error!Value {
    const FT = @TypeOf(func);
    const f = switch (@typeInfo(FT)) {
        .@"fn" => |f| f,
        else => @compileError("Function expected, found '" + @typeName(FT) + "'"),
    };
    // figure out how many arguments the function has and whether it needs the data pointer
    comptime var need_data = false;
    comptime var need_env = false;
    comptime var arg_count: usize = 0;
    comptime {
        for (f.params, 0..) |param, i| {
            const PT = param.type orelse @compileError("Missing parameter type");
            if (!need_env and PT == Env) {
                if (!need_data and i != 0) @compileError("Env is expected to be the first argument");
                if (need_data and i != 1) @compileError("Env is expected to be the second argument");
                need_env = true;
            } else if (PT == Value) {
                arg_count += 1;
            } else if (!need_data and @typeInfo(PT) == .pointer) {
                if (i != 0) @compileError("Data pointer is expected to be the first argument");
                need_data = true;
            } else @compileError("Unexpected argument '" + @typeName(PT) + "'");
        }
        if (need_this) {
            if (arg_count == 0) @compileError("Missing this argument");
            arg_count -= 1;
        }
    }
    const ns = struct {
        fn callback(env: Env, cb_info: CallbackInfo) callconv(.c) Value {
            return handleCall(env, cb_info) catch |err| {
                env.throwError(null, getErrorMessage(err)) catch {};
                return env.getUndefined() catch @panic("Cannot even get undefined");
            };
        }

        fn handleCall(env: Env, cb_info: CallbackInfo) !Value {
            // retrieve arguments from Node
            var argc = arg_count;
            var argv: [arg_count]Value = undefined;
            const this, const ptr = try env.getCbInfo(cb_info, &argc, &argv);
            // copy arguments into arg tuple
            var args: std.meta.ArgsTuple(FT) = undefined;
            comptime var offset: usize = 0;
            if (need_data) {
                args[offset] = @ptrCast(@alignCast(ptr.?));
                offset += 1;
            }
            if (need_env) {
                args[offset] = env;
                offset += 1;
            }
            if (need_this) {
                args[offset] = this;
                offset += 1;
            }
            inline for (0..arg_count) |i| {
                args[offset + i] = if (i < argc) argv[i] else try env.getUndefined();
            }
            // call function
            const retval = @call(.auto, func, args);
            // check for error if it's possible
            const result = switch (@typeInfo(@TypeOf(retval))) {
                .error_union => try retval,
                else => retval,
            };
            // deal with void retval
            const RT = @TypeOf(result);
            return switch (RT) {
                Value => result,
                void => try env.getUndefined(),
                else => @compileError("Return value must be void or Value, found '" + @typeName(RT) + "'"),
            };
        }
    };
    if ((need_data and data == null) or (!need_data and data != null)) {
        return error.InvalidArg;
    }
    return try self.createFunction(utf8name, ns.callback, data);
}

fn getErrorMessage(err: anytype) [:0]const u8 {
    @setEvalBranchQuota(200000);
    switch (err) {
        inline else => |e| {
            const message = comptime decamelize: {
                const name = @errorName(e);
                var cap_count: usize = 0;
                for (name, 0..) |letter, i| {
                    if (i > 0 and std.ascii.isUpper(letter)) cap_count += 1;
                }
                var buffer: [name.len + cap_count + 1]u8 = undefined;
                var index: usize = 0;
                for (name, 0..) |letter, i| {
                    if (std.ascii.isUpper(letter)) {
                        if (i > 0) {
                            buffer[index] = ' ';
                            index += 1;
                            buffer[index] = std.ascii.toLower(letter);
                        } else {
                            buffer[index] = letter;
                        }
                    } else {
                        buffer[index] = letter;
                    }
                    index += 1;
                }
                buffer[index] = 0;
                break :decamelize buffer;
            };
            return @ptrCast(&message);
        },
    }
}

fn getProcAddress(name: [:0]const u8) *const anyopaque {
    const module = std.os.windows.kernel32.GetModuleHandleW(null) orelse unreachable;
    return std.os.windows.kernel32.GetProcAddress(module, name) orelse {
        var buffer: [256]u8 = undefined;
        const msg = std.fmt.bufPrint(&buffer, "Unable to import function: {s}", .{name}) catch &buffer;
        @panic(msg);
    };
}

const late_binder = switch (builtin.target.os.tag) {
    .windows => getProcAddress,
    else => null,
};
