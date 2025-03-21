const std = @import("std");
const fn_transform = @import("./fn-transform.zig");
const c = @cImport({
    @cInclude("../node_modules/node-api-headers/include/node_api.h");
});

pub const Value = c.napi_value;
pub const Ref = c.napi_ref;
pub const ExtendedErrorInfo = c.napi_extended_error_info;
pub const ApiBasicEnv = c.node_api_basic_env;
pub const ThreadsafeFunction = c.napi_threadsafe_function;
pub const ThreadsafeFunctionReleaseMode = enum(c_uint) {
    release,
    abort,
};
pub const ThreadsafeFunctionCallMode = enum(c_uint) {
    nonblocking,
    blocking,
};
pub const NapiError = error{
    Unexpected,
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
};
pub const Env = opaque {
    // Environment life cycle APIs
    pub const setInstanceData = translateFromC(c.napi_set_instance_data);
    pub const getInstanceData = translateFromC(c.napi_get_instance_data);
    // Error handling
    pub const getLastErrorInfo = translateFromC(c.napi_get_last_error_info);
    // Exceptions
    pub const throw = translateFromC(c.napi_throw);
    pub const throwError = translateFromC(c.napi_throw_error);
    pub const throwTypeError = translateFromC(c.napi_throw_type_error);
    pub const throwRangeError = translateFromC(c.napi_throw_range_error);
    pub const throwSyntaxError = translateFromC(c.node_api_throw_syntax_error);
    pub const createError = translateFromC(c.napi_create_error);
    pub const createTypeError = translateFromC(c.napi_create_type_error);
    pub const createRangeError = translateFromC(c.napi_create_range_error);
    pub const createSyntaxError = translateFromC(c.node_api_create_syntax_error);
    pub const getAndClearLastException = translateFromC(c.napi_get_and_clear_last_exception);
    pub const isExceptionPending = translateFromC(c.napi_is_exception_pending);
    pub const fatalException = translateFromC(c.napi_fatal_exception);
    // Fatal errors
    pub const fatalError = translateFromC(c.napi_fatal_error);
    // Making handle lifespan shorter than that of the native method
    pub const openHandleScope = translateFromC(c.napi_open_handle_scope);
    pub const closeHandleScope = translateFromC(c.napi_close_handle_scope);
    pub const openEscapableHandleScope = translateFromC(c.napi_open_escapable_handle_scope);
    pub const closeEscapableHandleScope = translateFromC(c.napi_close_escapable_handle_scope);
    pub const escapeHandle = translateFromC(c.napi_escape_handle);
    // References to values with a lifespan longer than that of the native method
    pub const createReference = translateFromC(c.napi_create_reference);
    pub const deleteReference = translateFromC(c.napi_delete_reference);
    pub const referenceRef = translateFromC(c.napi_reference_ref);
    pub const referenceUnref = translateFromC(c.napi_reference_unref);
    pub const getReferenceValue = translateFromC(c.napi_get_reference_value);
    // Cleanup on exit of the current Node.js environment
    pub const addEnvCleanupHook = translateFromC(c.napi_add_env_cleanup_hook);
    pub const removeEnvCleanupHook = translateFromC(c.napi_remove_env_cleanup_hook);
    pub const addAsyncCleanupHook = translateFromC(c.napi_add_async_cleanup_hook);
    pub const removeAsyncCleanupHook = translateFromC(c.napi_remove_async_cleanup_hook);
    // Object creation functions
    pub const createArray = translateFromC(c.napi_create_array);
    pub const createArrayWithLength = translateFromC(c.napi_create_array_with_length);
    pub const createArraybuffer = translateFromC(c.napi_create_arraybuffer);
    pub const createBuffer = translateFromC(c.napi_create_buffer);
    pub const createBufferCopy = translateFromC(c.napi_create_buffer_copy);
    pub const createDate = translateFromC(c.napi_create_date);
    pub const createExternal = translateFromC(c.napi_create_external);
    pub const createExternalArraybuffer = translateFromC(c.napi_create_external_arraybuffer);
    pub const createExternalBuffer = translateFromC(c.napi_create_external_buffer);
    pub const createObject = translateFromC(c.napi_create_object);
    pub const createSymbol = translateFromC(c.napi_create_symbol);
    pub const symbolFor = translateFromC(c.node_api_symbol_for);
    pub const createTypedarray = translateFromC(c.napi_create_typedarray);
    pub const createBufferFromArraybuffer = translateFromC(c.node_api_create_buffer_from_arraybuffer);
    pub const createDataview = translateFromC(c.napi_create_dataview);
    // Functions to convert from C types to Node-API
    pub const createInt32 = translateFromC(c.napi_create_int32);
    pub const createUint32 = translateFromC(c.napi_create_uint32);
    pub const createInt64 = translateFromC(c.napi_create_int64);
    pub const createDouble = translateFromC(c.napi_create_double);
    pub const createBigintInt64 = translateFromC(c.napi_create_bigint_int64);
    pub const createBigintUint64 = translateFromC(c.napi_create_bigint_uint64);
    pub const createBigintWords = translateFromC(c.napi_create_bigint_words);
    pub const createStringLatin1 = translateFromC(c.napi_create_string_latin1);
    pub const createExternalStringLatin1 = translateFromC(c.node_api_create_external_string_latin1);
    pub const createStringUtf16 = translateFromC(c.napi_create_string_utf16);
    pub const createExternalStringUtf16 = translateFromC(c.node_api_create_external_string_utf16);
    pub const createStringUtf8 = translateFromC(c.napi_create_string_utf8);
    // Functions to create optimized property keys
    pub const createPropertyKeyLatin1 = translateFromC(c.node_api_create_property_key_latin1);
    pub const createPropertyKeyUtf16 = translateFromC(c.node_api_create_property_key_utf16);
    pub const createPropertyKeyUtf8 = translateFromC(c.node_api_create_property_key_utf8);
    // Functions to convert from Node-API to C types
    pub const getArrayLength = translateFromC(c.napi_get_array_length);
    pub const getArraybufferInfo = translateFromC(c.napi_get_arraybuffer_info);
    pub const getBufferInfo = translateFromC(c.napi_get_buffer_info);
    pub const getPrototype = translateFromC(c.napi_get_prototype);
    pub const getTypedarrayInfo = translateFromC(c.napi_get_typedarray_info);
    pub const getDataviewInfo = translateFromC(c.napi_get_dataview_info);
    pub const getDateValue = translateFromC(c.napi_get_date_value);
    pub const getValueBool = translateFromC(c.napi_get_value_bool);
    pub const getValueDouble = translateFromC(c.napi_get_value_double);
    pub const getValueBigintInt64 = translateFromC(c.napi_get_value_bigint_int64);
    pub const getValueBigintUint64 = translateFromC(c.napi_get_value_bigint_uint64);
    pub const getValueBigintWords = translateFromC(c.napi_get_value_bigint_words);
    pub const getValueExternal = translateFromC(c.napi_get_value_external);
    pub const getValueInt32 = translateFromC(c.napi_get_value_int32);
    pub const getValueInt64 = translateFromC(c.napi_get_value_int64);
    pub const getValueStringLatin1 = translateFromC(c.napi_get_value_string_latin1);
    pub const getValueStringUtf8 = translateFromC(c.napi_get_value_string_utf8);
    pub const getValueStringUtf16 = translateFromC(c.napi_get_value_string_utf16);
    pub const getValueUint32 = translateFromC(c.napi_get_value_uint32);
    // Functions to get global instances
    pub const getBoolean = translateFromC(c.napi_get_boolean);
    pub const getGlobal = translateFromC(c.napi_get_global);
    pub const getNull = translateFromC(c.napi_get_null);
    pub const getUndefined = translateFromC(c.napi_get_undefined);
    // Working with JavaScript values and abstract operations
    pub const coerceToBool = translateFromC(c.napi_coerce_to_bool);
    pub const coerceToNumber = translateFromC(c.napi_coerce_to_number);
    pub const coerceToObject = translateFromC(c.napi_coerce_to_object);
    pub const coerceToString = translateFromC(c.napi_coerce_to_string);
    pub const typeof = translateFromC(c.napi_typeof);
    pub const instanceof = translateFromC(c.napi_instanceof);
    pub const isArray = translateFromC(c.napi_is_array);
    pub const isArraybuffer = translateFromC(c.napi_is_arraybuffer);
    pub const isBuffer = translateFromC(c.napi_is_buffer);
    pub const isDate = translateFromC(c.napi_is_date);
    pub const isError = translateFromC(c.napi_is_error);
    pub const isTypedarray = translateFromC(c.napi_is_typedarray);
    pub const isDataview = translateFromC(c.napi_is_dataview);
    pub const strictEquals = translateFromC(c.napi_strict_equals);
    pub const detachArraybuffer = translateFromC(c.napi_detach_arraybuffer);
    pub const isDetachedArraybuffer = translateFromC(c.napi_is_detached_arraybuffer);
    // Structures
    pub const propertyAttributes = translateFromC(c.napi_property_attributes);
    pub const propertyDescriptor = translateFromC(c.napi_property_descriptor);
    // Functions
    pub const getPropertyNames = translateFromC(c.napi_get_property_names);
    pub const getAllPropertyNames = translateFromC(c.napi_get_all_property_names);
    pub const setProperty = translateFromC(c.napi_set_property);
    pub const getProperty = translateFromC(c.napi_get_property);
    pub const hasProperty = translateFromC(c.napi_has_property);
    pub const deleteProperty = translateFromC(c.napi_delete_property);
    pub const hasOwnProperty = translateFromC(c.napi_has_own_property);
    pub const setNamedProperty = translateFromC(c.napi_set_named_property);
    pub const getNamedProperty = translateFromC(c.napi_get_named_property);
    pub const hasNamedProperty = translateFromC(c.napi_has_named_property);
    pub const setElement = translateFromC(c.napi_set_element);
    pub const getElement = translateFromC(c.napi_get_element);
    pub const hasElement = translateFromC(c.napi_has_element);
    pub const deleteElement = translateFromC(c.napi_delete_element);
    pub const defineProperties = translateFromC(c.napi_define_properties);
    pub const objectFreeze = translateFromC(c.napi_object_freeze);
    pub const objectSeal = translateFromC(c.napi_object_seal);
    // Working with JavaScript functions
    pub const callFunction = translateFromC(c.napi_call_function);
    pub const createFunction = translateFromC(c.napi_create_function);
    pub const getCbInfo = translateFromC(c.napi_get_cb_info);
    pub const getNewTarget = translateFromC(c.napi_get_new_target);
    pub const newInstance = translateFromC(c.napi_new_instance);
    // Object wrap
    pub const defineClass = translateFromC(c.napi_define_class);
    pub const wrap = translateFromC(c.napi_wrap);
    pub const unwrap = translateFromC(c.napi_unwrap);
    pub const removeWrap = translateFromC(c.napi_remove_wrap);
    pub const typeTagObject = translateFromC(c.napi_type_tag_object);
    pub const checkObjectTypeTag = translateFromC(c.napi_check_object_type_tag);
    pub const addFinalizer = translateFromC(c.napi_add_finalizer);
    pub const postFinalizer = translateFromC(c.node_api_post_finalizer);
    // Simple asynchronous operations
    pub const createAsyncWork = translateFromC(c.napi_create_async_work);
    pub const deleteAsyncWork = translateFromC(c.napi_delete_async_work);
    pub const queueAsyncWork = translateFromC(c.napi_queue_async_work);
    pub const cancelAsyncWork = translateFromC(c.napi_cancel_async_work);
    // Custom asynchronous operations
    pub const asyncInit = translateFromC(c.napi_async_init);
    pub const asyncDestroy = translateFromC(c.napi_async_destroy);
    pub const makeCallback = translateFromC(c.napi_make_callback);
    pub const openCallbackScope = translateFromC(c.napi_open_callback_scope);
    pub const closeCallbackScope = translateFromC(c.napi_close_callback_scope);
    // Version management
    pub const getNodeVersion = translateFromC(c.napi_get_node_version);
    pub const getVersion = translateFromC(c.napi_get_version);
    // Memory management
    pub const adjustExternalMemory = translateFromC(c.napi_adjust_external_memory);
    // Promises
    pub const createPromise = translateFromC(c.napi_create_promise);
    pub const resolveDeferred = translateFromC(c.napi_resolve_deferred);
    pub const rejectDeferred = translateFromC(c.napi_reject_deferred);
    pub const isPromise = translateFromC(c.napi_is_promise);
    // Script execution
    pub const runScript = translateFromC(c.napi_run_script);
    // libuv event loop
    pub const getUvEventLoop = translateFromC(c.napi_get_uv_event_loop);
    // Asynchronous thread-safe function calls
    pub const createThreadsafeFunction = translateFromC(c.napi_create_threadsafe_function);
    pub const getThreadsafeFunctionContext = translateFromC(c.napi_get_threadsafe_function_context);
    pub const callThreadsafeFunction = translateFromC(c.napi_call_threadsafe_function);
    pub const acquireThreadsafeFunction = translateFromC(c.napi_acquire_threadsafe_function);
    pub const releaseThreadsafeFunction = translateFromC(c.napi_release_threadsafe_function);
    pub const refThreadsafeFunction = translateFromC(c.napi_ref_threadsafe_function);
    pub const unrefThreadsafeFunction = translateFromC(c.napi_unref_threadsafe_function);
    // Miscellaneous utilities
    pub const getModuleFileName = translateFromC(c.node_api_get_module_file_name);
};

fn TranslatedFromC(comptime func: anytype) type {
    const CFT = @TypeOf(func);
    const cf = @typeInfo(CFT).@"fn";
    const RTP = init: {
        const LastParam = cf.params[cf.params.len - 1].type.?;
        switch (@typeInfo(LastParam)) {
            .pointer => |pt| if (!pt.is_const) {
                break :init switch (@typeInfo(pt.child)) {
                    .optional => |op| op.child,
                    else => pt.child,
                };
            },
            else => {},
        }
        break :init void;
    };
    const param_count = cf.params.len - if (RTP != void) 1 else 0;
    var params: [param_count]std.builtin.Type.Fn.Param = undefined;
    inline for (cf.params, 0..) |param, index| {
        if (index < param_count) {
            const CPT = param.type.?;
            const TPT = switch (CPT) {
                c.napi_env => *Env,
                c_uint => TranslateEnumType(func, index),
                else => CPT,
            };
            params[index] = .{
                .type = TPT,
                .is_generic = false,
                .is_noalias = false,
            };
        }
    }
    return @Type(.{
        .@"fn" = .{
            .calling_convention = .auto,
            .is_generic = false,
            .is_var_args = false,
            .return_type = NapiError!RTP,
            .params = &params,
        },
    });
}

fn TranslateEnumType(comptime func: anytype, comptime index: usize) type {
    const enum_type_list = .{
        .{ .type = ThreadsafeFunctionCallMode, .function = c.napi_call_threadsafe_function, .index = 2 },
        .{ .type = ThreadsafeFunctionReleaseMode, .function = c.napi_release_threadsafe_function, .index = 1 },
    };
    return inline for (enum_type_list) |e| {
        if (@TypeOf(func) == @TypeOf(e.function)) {
            if (func == e.function and index == e.index) {
                break e.type;
            }
        }
    } else c_uint;
}

fn translateFromC(comptime func: anytype) TranslatedFromC(func) {
    const CFT = @TypeOf(func);
    const TFT = TranslatedFromC(func);
    const RT = @typeInfo(TFT).@"fn".return_type.?;
    const RTP = @typeInfo(RT).error_union.payload;
    const error_list = init: {
        const es = @typeInfo(NapiError).error_set.?;
        var list: [es.len]NapiError = undefined;
        for (es, 0..) |e, index| {
            list[index] = @field(NapiError, e.name);
        }
        break :init list;
    };
    const ns = struct {
        inline fn call(args: std.meta.ArgsTuple(TFT)) RT {
            var cf_args: std.meta.ArgsTuple(CFT) = undefined;
            inline for (args, 0..) |arg, index| {
                if (@typeInfo(@TypeOf(arg)) == .pointer) {
                    cf_args[index] = @ptrCast(arg);
                } else {
                    cf_args[index] = arg;
                }
            }
            var result: RTP = undefined;
            if (RTP != void) {
                cf_args[cf_args.len - 1] = @ptrCast(&result);
            }
            const status = @call(.auto, func, cf_args);
            if (status == c.napi_status.napi_ok) {
                return result;
            } else {
                const num = @intFromEnum(status);
                const index = if (num < error_list.len) num else 0;
                return error_list[index];
            }
        }
    };
    return fn_transform.spreadArgs(ns.call, .auto);
}
