#include "./win32-shim.h"

/* Node-API */
#define NAPI_EXTERN        extern
#define NAPI_FUNC_COUNT    147

void* func_ptrs[NAPI_FUNC_COUNT];

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_last_error_info(napi_env env, const napi_extended_error_info** result) {
    napi_status (NAPI_CDECL *f)(napi_env, const napi_extended_error_info**) = func_ptrs[0];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_undefined(napi_env env,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value*) = func_ptrs[1];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_null(napi_env env,
                                                 napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value*) = func_ptrs[2];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_global(napi_env env,
                                                   napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value*) = func_ptrs[3];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_boolean(napi_env env,
                                                    bool value,
                                                    napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, bool, napi_value*) = func_ptrs[4];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_object(napi_env env,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value*) = func_ptrs[5];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_array(napi_env env,
                                                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value*) = func_ptrs[6];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_array_with_length(napi_env env, size_t length, napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, size_t, napi_value*) = func_ptrs[7];
    return f(env, length, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_double(napi_env env,
                                                      double value,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, double, napi_value*) = func_ptrs[8];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_int32(napi_env env,
                                                     int32_t value,
                                                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, int32_t, napi_value*) = func_ptrs[9];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_uint32(napi_env env,
                                                      uint32_t value,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, uint32_t, napi_value*) = func_ptrs[10];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_int64(napi_env env,
                                                     int64_t value,
                                                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, int64_t, napi_value*) = func_ptrs[11];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_string_latin1(
    napi_env env, const char* str, size_t length, napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, size_t, napi_value*) = func_ptrs[12];
    return f(env, str, length, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_string_utf8(napi_env env,
                                                           const char* str,
                                                           size_t length,
                                                           napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, size_t, napi_value*) = func_ptrs[13];
    return f(env, str, length, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_string_utf16(napi_env env,
                                                            const char16_t* str,
                                                            size_t length,
                                                            napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char16_t*, size_t, napi_value*) = func_ptrs[14];
    return f(env, str, length, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_symbol(napi_env env,
                                                      napi_value description,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[15];
    return f(env, description, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
node_api_symbol_for(napi_env env,
                    const char* utf8description,
                    size_t length,
                    napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, size_t, napi_value*) = func_ptrs[16];
    return f(env, utf8description, length, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_function(napi_env env,
                                                        const char* utf8name,
                                                        size_t length,
                                                        napi_callback cb,
                                                        void* data,
                                                        napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, size_t, napi_callback, void*, napi_value*) = func_ptrs[17];
    return f(env, utf8name, length, cb, data, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_error(napi_env env,
                                                     napi_value code,
                                                     napi_value msg,
                                                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value*) = func_ptrs[18];
    return f(env, code, msg, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_type_error(napi_env env,
                                                          napi_value code,
                                                          napi_value msg,
                                                          napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value*) = func_ptrs[19];
    return f(env, code, msg, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_range_error(napi_env env,
                                                           napi_value code,
                                                           napi_value msg,
                                                           napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value*) = func_ptrs[20];
    return f(env, code, msg, result);
}

NAPI_EXTERN napi_status NAPI_CDECL node_api_create_syntax_error(
    napi_env env, napi_value code, napi_value msg, napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value*) = func_ptrs[21];
    return f(env, code, msg, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_typeof(napi_env env,
                                               napi_value value,
                                               napi_valuetype* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_valuetype*) = func_ptrs[22];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_double(napi_env env,
                                                         napi_value value,
                                                         double* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, double*) = func_ptrs[23];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_int32(napi_env env,
                                                        napi_value value,
                                                        int32_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, int32_t*) = func_ptrs[24];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_uint32(napi_env env,
                                                         napi_value value,
                                                         uint32_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t*) = func_ptrs[25];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_int64(napi_env env,
                                                        napi_value value,
                                                        int64_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, int64_t*) = func_ptrs[26];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_bool(napi_env env,
                                                       napi_value value,
                                                       bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[27];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_string_latin1(
    napi_env env, napi_value value, char* buf, size_t bufsize, size_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, char*, size_t, size_t*) = func_ptrs[28];
    return f(env, value, buf, bufsize, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_string_utf8(
    napi_env env, napi_value value, char* buf, size_t bufsize, size_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, char*, size_t, size_t*) = func_ptrs[29];
    return f(env, value, buf, bufsize, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_string_utf16(napi_env env,
                                                               napi_value value,
                                                               char16_t* buf,
                                                               size_t bufsize,
                                                               size_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, char16_t*, size_t, size_t*) = func_ptrs[30];
    return f(env, value, buf, bufsize, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_coerce_to_bool(napi_env env,
                                                       napi_value value,
                                                       napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[31];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_coerce_to_number(napi_env env,
                                                         napi_value value,
                                                         napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[32];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_coerce_to_object(napi_env env,
                                                         napi_value value,
                                                         napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[33];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_coerce_to_string(napi_env env,
                                                         napi_value value,
                                                         napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[34];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_prototype(napi_env env,
                                                      napi_value object,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[35];
    return f(env, object, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_property_names(napi_env env,
                                                           napi_value object,
                                                           napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[36];
    return f(env, object, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_set_property(napi_env env,
                                                     napi_value object,
                                                     napi_value key,
                                                     napi_value value) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value) = func_ptrs[37];
    return f(env, object, key, value);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_has_property(napi_env env,
                                                     napi_value object,
                                                     napi_value key,
                                                     bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, bool*) = func_ptrs[38];
    return f(env, object, key, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_property(napi_env env,
                                                     napi_value object,
                                                     napi_value key,
                                                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value*) = func_ptrs[39];
    return f(env, object, key, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_delete_property(napi_env env,
                                                        napi_value object,
                                                        napi_value key,
                                                        bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, bool*) = func_ptrs[40];
    return f(env, object, key, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_has_own_property(napi_env env,
                                                         napi_value object,
                                                         napi_value key,
                                                         bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, bool*) = func_ptrs[41];
    return f(env, object, key, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_set_named_property(napi_env env,
                                                           napi_value object,
                                                           const char* utf8name,
                                                           napi_value value) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, const char*, napi_value) = func_ptrs[42];
    return f(env, object, utf8name, value);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_has_named_property(napi_env env,
                                                           napi_value object,
                                                           const char* utf8name,
                                                           bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, const char*, bool*) = func_ptrs[43];
    return f(env, object, utf8name, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_named_property(napi_env env,
                                                           napi_value object,
                                                           const char* utf8name,
                                                           napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, const char*, napi_value*) = func_ptrs[44];
    return f(env, object, utf8name, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_set_element(napi_env env,
                                                    napi_value object,
                                                    uint32_t index,
                                                    napi_value value) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t, napi_value) = func_ptrs[45];
    return f(env, object, index, value);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_has_element(napi_env env,
                                                    napi_value object,
                                                    uint32_t index,
                                                    bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t, bool*) = func_ptrs[46];
    return f(env, object, index, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_element(napi_env env,
                                                    napi_value object,
                                                    uint32_t index,
                                                    napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t, napi_value*) = func_ptrs[47];
    return f(env, object, index, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_delete_element(napi_env env,
                                                       napi_value object,
                                                       uint32_t index,
                                                       bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t, bool*) = func_ptrs[48];
    return f(env, object, index, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_define_properties(napi_env env,
                       napi_value object,
                       size_t property_count,
                       const napi_property_descriptor* properties) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, size_t, const napi_property_descriptor*) = func_ptrs[49];
    return f(env, object, property_count, properties);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_array(napi_env env,
                                                 napi_value value,
                                                 bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[50];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_array_length(napi_env env,
                                                         napi_value value,
                                                         uint32_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t*) = func_ptrs[51];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_strict_equals(napi_env env,
                                                      napi_value lhs,
                                                      napi_value rhs,
                                                      bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, bool*) = func_ptrs[52];
    return f(env, lhs, rhs, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_call_function(napi_env env,
                                                      napi_value recv,
                                                      napi_value func,
                                                      size_t argc,
                                                      const napi_value* argv,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, size_t, const napi_value*, napi_value*) = func_ptrs[53];
    return f(env, recv, func, argc, argv, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_new_instance(napi_env env,
                                                     napi_value constructor,
                                                     size_t argc,
                                                     const napi_value* argv,
                                                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, size_t, const napi_value*, napi_value*) = func_ptrs[54];
    return f(env, constructor, argc, argv, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_instanceof(napi_env env,
                                                   napi_value object,
                                                   napi_value constructor,
                                                   bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, bool*) = func_ptrs[55];
    return f(env, object, constructor, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_cb_info(
    napi_env env,               // [in] NAPI environment handle
    napi_callback_info cbinfo,  // [in] Opaque callback-info handle
    size_t* argc,      // [in-out] Specifies the size of the provided argv array
                       // and receives the actual count of args.
    napi_value* argv,  // [out] Array of values
    napi_value* this_arg,  // [out] Receives the JS 'this' arg for the call
    void** data) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_callback_info, size_t*, napi_value*, napi_value*, void**) = func_ptrs[56];
    return f(env, cbinfo, argc, argv, this_arg, data);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_new_target(
    napi_env env, napi_callback_info cbinfo, napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_callback_info, napi_value*) = func_ptrs[57];
    return f(env, cbinfo, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_define_class(napi_env env,
                  const char* utf8name,
                  size_t length,
                  napi_callback constructor,
                  void* data,
                  size_t property_count,
                  const napi_property_descriptor* properties,
                  napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, size_t, napi_callback, void*, size_t, const napi_property_descriptor*, napi_value*) = func_ptrs[58];
    return f(env, utf8name, length, constructor, data, property_count, properties, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_wrap(napi_env env,
                                             napi_value js_object,
                                             void* native_object,
                                             napi_finalize finalize_cb,
                                             void* finalize_hint,
                                             napi_ref* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void*, napi_finalize, void*, napi_ref*) = func_ptrs[59];
    return f(env, js_object, native_object, finalize_cb, finalize_hint, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_unwrap(napi_env env,
                                               napi_value js_object,
                                               void** result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void**) = func_ptrs[60];
    return f(env, js_object, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_remove_wrap(napi_env env,
                                                    napi_value js_object,
                                                    void** result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void**) = func_ptrs[61];
    return f(env, js_object, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_external(napi_env env,
                     void* data,
                     napi_finalize finalize_cb,
                     void* finalize_hint,
                     napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, void*, napi_finalize, void*, napi_value*) = func_ptrs[62];
    return f(env, data, finalize_cb, finalize_hint, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_external(napi_env env,
                                                           napi_value value,
                                                           void** result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void**) = func_ptrs[63];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_reference(napi_env env,
                      napi_value value,
                      uint32_t initial_refcount,
                      napi_ref* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint32_t, napi_ref*) = func_ptrs[64];
    return f(env, value, initial_refcount, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_delete_reference(napi_env env,
                                                         napi_ref ref) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_ref) = func_ptrs[65];
    return f(env, ref);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_reference_ref(napi_env env,
                                                      napi_ref ref,
                                                      uint32_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_ref, uint32_t*) = func_ptrs[66];
    return f(env, ref, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_reference_unref(napi_env env,
                                                        napi_ref ref,
                                                        uint32_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_ref, uint32_t*) = func_ptrs[67];
    return f(env, ref, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_reference_value(napi_env env,
                                                            napi_ref ref,
                                                            napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_ref, napi_value*) = func_ptrs[68];
    return f(env, ref, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_open_handle_scope(napi_env env, napi_handle_scope* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_handle_scope*) = func_ptrs[69];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_close_handle_scope(napi_env env, napi_handle_scope scope) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_handle_scope) = func_ptrs[70];
    return f(env, scope);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_open_escapable_handle_scope(
    napi_env env, napi_escapable_handle_scope* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_escapable_handle_scope*) = func_ptrs[71];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_close_escapable_handle_scope(
    napi_env env, napi_escapable_handle_scope scope) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_escapable_handle_scope) = func_ptrs[72];
    return f(env, scope);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_escape_handle(napi_env env,
                   napi_escapable_handle_scope scope,
                   napi_value escapee,
                   napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_escapable_handle_scope, napi_value, napi_value*) = func_ptrs[73];
    return f(env, scope, escapee, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_throw(napi_env env, napi_value error) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value) = func_ptrs[74];
    return f(env, error);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_throw_error(napi_env env,
                                                    const char* code,
                                                    const char* msg) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, const char*) = func_ptrs[75];
    return f(env, code, msg);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_throw_type_error(napi_env env,
                                                         const char* code,
                                                         const char* msg) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, const char*) = func_ptrs[76];
    return f(env, code, msg);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_throw_range_error(napi_env env,
                                                          const char* code,
                                                          const char* msg) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, const char*) = func_ptrs[77];
    return f(env, code, msg);
}

NAPI_EXTERN napi_status NAPI_CDECL node_api_throw_syntax_error(napi_env env,
                                                               const char* code,
                                                               const char* msg) {
    napi_status (NAPI_CDECL *f)(napi_env, const char*, const char*) = func_ptrs[78];
    return f(env, code, msg);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_error(napi_env env,
                                                 napi_value value,
                                                 bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[79];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_exception_pending(napi_env env,
                                                             bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, bool*) = func_ptrs[80];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_and_clear_last_exception(napi_env env, napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value*) = func_ptrs[81];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_arraybuffer(napi_env env,
                                                       napi_value value,
                                                       bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[82];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_arraybuffer(napi_env env,
                                                           size_t byte_length,
                                                           void** data,
                                                           napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, size_t, void**, napi_value*) = func_ptrs[83];
    return f(env, byte_length, data, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_external_arraybuffer(napi_env env,
                                 void* external_data,
                                 size_t byte_length,
                                 napi_finalize finalize_cb,
                                 void* finalize_hint,
                                 napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, void*, size_t, napi_finalize, void*, napi_value*) = func_ptrs[84];
    return f(env, external_data, byte_length, finalize_cb, finalize_hint, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_arraybuffer_info(
    napi_env env, napi_value arraybuffer, void** data, size_t* byte_length) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void**, size_t*) = func_ptrs[85];
    return f(env, arraybuffer, data, byte_length);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_typedarray(napi_env env,
                                                      napi_value value,
                                                      bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[86];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_typedarray(napi_env env,
                       napi_typedarray_type type,
                       size_t length,
                       napi_value arraybuffer,
                       size_t byte_offset,
                       napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_typedarray_type, size_t, napi_value, size_t, napi_value*) = func_ptrs[87];
    return f(env, type, length, arraybuffer, byte_offset, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_typedarray_info(napi_env env,
                         napi_value typedarray,
                         napi_typedarray_type* type,
                         size_t* length,
                         void** data,
                         napi_value* arraybuffer,
                         size_t* byte_offset) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_typedarray_type*, size_t*, void**, napi_value*, size_t*) = func_ptrs[88];
    return f(env, typedarray, type, length, data, arraybuffer, byte_offset);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_dataview(napi_env env,
                                                        size_t length,
                                                        napi_value arraybuffer,
                                                        size_t byte_offset,
                                                        napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, size_t, napi_value, size_t, napi_value*) = func_ptrs[89];
    return f(env, length, arraybuffer, byte_offset, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_dataview(napi_env env,
                                                    napi_value value,
                                                    bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[90];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_dataview_info(napi_env env,
                       napi_value dataview,
                       size_t* bytelength,
                       void** data,
                       napi_value* arraybuffer,
                       size_t* byte_offset) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, size_t*, void**, napi_value*, size_t*) = func_ptrs[91];
    return f(env, dataview, bytelength, data, arraybuffer, byte_offset);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_version(napi_env env,
                                                    uint32_t* result) {
    napi_status (NAPI_CDECL *f)(napi_env, uint32_t*) = func_ptrs[92];
    return f(env, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_promise(napi_env env,
                                                       napi_deferred* deferred,
                                                       napi_value* promise) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_deferred*, napi_value*) = func_ptrs[93];
    return f(env, deferred, promise);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_resolve_deferred(napi_env env,
                                                         napi_deferred deferred,
                                                         napi_value resolution) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_deferred, napi_value) = func_ptrs[94];
    return f(env, deferred, resolution);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_reject_deferred(napi_env env,
                                                        napi_deferred deferred,
                                                        napi_value rejection) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_deferred, napi_value) = func_ptrs[95];
    return f(env, deferred, rejection);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_promise(napi_env env,
                                                   napi_value value,
                                                   bool* is_promise) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[96];
    return f(env, value, is_promise);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_run_script(napi_env env,
                                                   napi_value script,
                                                   napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value*) = func_ptrs[97];
    return f(env, script, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_adjust_external_memory(
    napi_env env, int64_t change_in_bytes, int64_t* adjusted_value) {
    napi_status (NAPI_CDECL *f)(napi_env, int64_t, int64_t*) = func_ptrs[98];
    return f(env, change_in_bytes, adjusted_value);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_date(napi_env env,
                                                    double time,
                                                    napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, double, napi_value*) = func_ptrs[99];
    return f(env, time, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_date(napi_env env,
                                                napi_value value,
                                                bool* is_date) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[100];
    return f(env, value, is_date);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_date_value(napi_env env,
                                                       napi_value value,
                                                       double* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, double*) = func_ptrs[101];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_add_finalizer(napi_env env,
                                                      napi_value js_object,
                                                      void* finalize_data,
                                                      napi_finalize finalize_cb,
                                                      void* finalize_hint,
                                                      napi_ref* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void*, napi_finalize, void*, napi_ref*) = func_ptrs[102];
    return f(env, js_object, finalize_data, finalize_cb, finalize_hint, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_bigint_int64(napi_env env,
                                                            int64_t value,
                                                            napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, int64_t, napi_value*) = func_ptrs[103];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_bigint_uint64(napi_env env, uint64_t value, napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, uint64_t, napi_value*) = func_ptrs[104];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_bigint_words(napi_env env,
                         int sign_bit,
                         size_t word_count,
                         const uint64_t* words,
                         napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, int, size_t, const uint64_t*, napi_value*) = func_ptrs[105];
    return f(env, sign_bit, word_count, words, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_bigint_int64(napi_env env,
                                                               napi_value value,
                                                               int64_t* result,
                                                               bool* lossless) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, int64_t*, bool*) = func_ptrs[106];
    return f(env, value, result, lossless);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_value_bigint_uint64(
    napi_env env, napi_value value, uint64_t* result, bool* lossless) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, uint64_t*, bool*) = func_ptrs[107];
    return f(env, value, result, lossless);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_value_bigint_words(napi_env env,
                            napi_value value,
                            int* sign_bit,
                            size_t* word_count,
                            uint64_t* words) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, int*, size_t*, uint64_t*) = func_ptrs[108];
    return f(env, value, sign_bit, word_count, words);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_all_property_names(napi_env env,
                            napi_value object,
                            napi_key_collection_mode key_mode,
                            napi_key_filter key_filter,
                            napi_key_conversion key_conversion,
                            napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_key_collection_mode, napi_key_filter, napi_key_conversion, napi_value*) = func_ptrs[109];
    return f(env, object, key_mode, key_filter, key_conversion, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_set_instance_data(
    napi_env env, void* data, napi_finalize finalize_cb, void* finalize_hint) {
    napi_status (NAPI_CDECL *f)(napi_env, void*, napi_finalize, void*) = func_ptrs[110];
    return f(env, data, finalize_cb, finalize_hint);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_instance_data(napi_env env,
                                                          void** data) {
    napi_status (NAPI_CDECL *f)(napi_env, void**) = func_ptrs[111];
    return f(env, data);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_detach_arraybuffer(napi_env env, napi_value arraybuffer) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value) = func_ptrs[112];
    return f(env, arraybuffer);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_is_detached_arraybuffer(napi_env env, napi_value value, bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[113];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_type_tag_object(
    napi_env env, napi_value value, const napi_type_tag* type_tag) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, const napi_type_tag*) = func_ptrs[114];
    return f(env, value, type_tag);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_check_object_type_tag(napi_env env,
                           napi_value value,
                           const napi_type_tag* type_tag,
                           bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, const napi_type_tag*, bool*) = func_ptrs[115];
    return f(env, value, type_tag, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_object_freeze(napi_env env,
                                                      napi_value object) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value) = func_ptrs[116];
    return f(env, object);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_object_seal(napi_env env,
                                                    napi_value object) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value) = func_ptrs[117];
    return f(env, object);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_async_init(napi_env env,
                napi_value async_resource,
                napi_value async_resource_name,
                napi_async_context* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_async_context*) = func_ptrs[118];
    return f(env, async_resource, async_resource_name, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_async_destroy(napi_env env, napi_async_context async_context) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_async_context) = func_ptrs[119];
    return f(env, async_context);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_make_callback(napi_env env,
                   napi_async_context async_context,
                   napi_value recv,
                   napi_value func,
                   size_t argc,
                   const napi_value* argv,
                   napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_async_context, napi_value, napi_value, size_t, const napi_value*, napi_value*) = func_ptrs[120];
    return f(env, async_context, recv, func, argc, argv, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_buffer(napi_env env,
                                                      size_t length,
                                                      void** data,
                                                      napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, size_t, void**, napi_value*) = func_ptrs[121];
    return f(env, length, data, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_external_buffer(napi_env env,
                            size_t length,
                            void* data,
                            napi_finalize finalize_cb,
                            void* finalize_hint,
                            napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, size_t, void*, napi_finalize, void*, napi_value*) = func_ptrs[122];
    return f(env, length, data, finalize_cb, finalize_hint, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_create_buffer_copy(napi_env env,
                                                           size_t length,
                                                           const void* data,
                                                           void** result_data,
                                                           napi_value* result) {
    napi_status (NAPI_CDECL *f)(napi_env, size_t, const void*, void**, napi_value*) = func_ptrs[123];
    return f(env, length, data, result_data, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_is_buffer(napi_env env,
                                                  napi_value value,
                                                  bool* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, bool*) = func_ptrs[124];
    return f(env, value, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_buffer_info(napi_env env,
                                                        napi_value value,
                                                        void** data,
                                                        size_t* length) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, void**, size_t*) = func_ptrs[125];
    return f(env, value, data, length);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_async_work(napi_env env,
                       napi_value async_resource,
                       napi_value async_resource_name,
                       napi_async_execute_callback execute,
                       napi_async_complete_callback complete,
                       void* data,
                       napi_async_work* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_async_execute_callback, napi_async_complete_callback, void*, napi_async_work*) = func_ptrs[126];
    return f(env, async_resource, async_resource_name, execute, complete, data, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_delete_async_work(napi_env env,
                                                          napi_async_work work) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_async_work) = func_ptrs[127];
    return f(env, work);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_queue_async_work(napi_env env,
                                                         napi_async_work work) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_async_work) = func_ptrs[128];
    return f(env, work);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_cancel_async_work(napi_env env,
                                                          napi_async_work work) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_async_work) = func_ptrs[129];
    return f(env, work);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_node_version(napi_env env, const napi_node_version** version) {
    napi_status (NAPI_CDECL *f)(napi_env, const napi_node_version**) = func_ptrs[130];
    return f(env, version);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_get_uv_event_loop(napi_env env, struct uv_loop_s** loop) {
    napi_status (NAPI_CDECL *f)(napi_env, struct uv_loop_s**) = func_ptrs[131];
    return f(env, loop);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_fatal_exception(napi_env env,
                                                        napi_value err) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value) = func_ptrs[132];
    return f(env, err);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_add_env_cleanup_hook(napi_env env, napi_cleanup_hook fun, void* arg) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_cleanup_hook, void*) = func_ptrs[133];
    return f(env, fun, arg);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_remove_env_cleanup_hook(napi_env env, napi_cleanup_hook fun, void* arg) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_cleanup_hook, void*) = func_ptrs[134];
    return f(env, fun, arg);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_open_callback_scope(napi_env env,
                         napi_value resource_object,
                         napi_async_context context,
                         napi_callback_scope* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_async_context, napi_callback_scope*) = func_ptrs[135];
    return f(env, resource_object, context, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_close_callback_scope(napi_env env, napi_callback_scope scope) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_callback_scope) = func_ptrs[136];
    return f(env, scope);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_create_threadsafe_function(napi_env env,
                                napi_value func,
                                napi_value async_resource,
                                napi_value async_resource_name,
                                size_t max_queue_size,
                                size_t initial_thread_count,
                                void* thread_finalize_data,
                                napi_finalize thread_finalize_cb,
                                void* context,
                                napi_threadsafe_function_call_js call_js_cb,
                                napi_threadsafe_function* result) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_value, napi_value, napi_value, size_t, size_t, void*, napi_finalize, void*, napi_threadsafe_function_call_js, napi_threadsafe_function*) = func_ptrs[137];
    return f(env, func, async_resource, async_resource_name, max_queue_size, initial_thread_count, thread_finalize_data, thread_finalize_cb, context, call_js_cb, result);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_get_threadsafe_function_context(
    napi_threadsafe_function func, void** result) {
    napi_status (NAPI_CDECL *f)(napi_threadsafe_function, void**) = func_ptrs[138];
    return f(func, result);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_call_threadsafe_function(napi_threadsafe_function func,
                              void* data,
                              napi_threadsafe_function_call_mode is_blocking) {
    napi_status (NAPI_CDECL *f)(napi_threadsafe_function, void*, napi_threadsafe_function_call_mode) = func_ptrs[139];
    return f(func, data, is_blocking);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_acquire_threadsafe_function(napi_threadsafe_function func) {
    napi_status (NAPI_CDECL *f)(napi_threadsafe_function) = func_ptrs[140];
    return f(func);
}

NAPI_EXTERN napi_status NAPI_CDECL napi_release_threadsafe_function(
    napi_threadsafe_function func, napi_threadsafe_function_release_mode mode) {
    napi_status (NAPI_CDECL *f)(napi_threadsafe_function, napi_threadsafe_function_release_mode) = func_ptrs[141];
    return f(func, mode);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_unref_threadsafe_function(napi_env env, napi_threadsafe_function func) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_threadsafe_function) = func_ptrs[142];
    return f(env, func);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_ref_threadsafe_function(napi_env env, napi_threadsafe_function func) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_threadsafe_function) = func_ptrs[143];
    return f(env, func);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_add_async_cleanup_hook(napi_env env,
                            napi_async_cleanup_hook hook,
                            void* arg,
                            napi_async_cleanup_hook_handle* remove_handle) {
    napi_status (NAPI_CDECL *f)(napi_env, napi_async_cleanup_hook, void*, napi_async_cleanup_hook_handle*) = func_ptrs[144];
    return f(env, hook, arg, remove_handle);
}

NAPI_EXTERN napi_status NAPI_CDECL
napi_remove_async_cleanup_hook(napi_async_cleanup_hook_handle remove_handle) {
    napi_status (NAPI_CDECL *f)(napi_async_cleanup_hook_handle) = func_ptrs[145];
    return f(remove_handle);
}

NAPI_EXTERN napi_status NAPI_CDECL
node_api_get_module_file_name(napi_env env, const char** result) {
    napi_status (NAPI_CDECL *f)(napi_env, const char**) = func_ptrs[146];
    return f(env, result);
}

const char* func_names[NAPI_FUNC_COUNT] = {
    "napi_get_last_error_info",
    "napi_get_undefined",
    "napi_get_null",
    "napi_get_global",
    "napi_get_boolean",
    "napi_create_object",
    "napi_create_array",
    "napi_create_array_with_length",
    "napi_create_double",
    "napi_create_int32",
    "napi_create_uint32",
    "napi_create_int64",
    "napi_create_string_latin1",
    "napi_create_string_utf8",
    "napi_create_string_utf16",
    "napi_create_symbol",
    "node_api_symbol_for",
    "napi_create_function",
    "napi_create_error",
    "napi_create_type_error",
    "napi_create_range_error",
    "node_api_create_syntax_error",
    "napi_typeof",
    "napi_get_value_double",
    "napi_get_value_int32",
    "napi_get_value_uint32",
    "napi_get_value_int64",
    "napi_get_value_bool",
    "napi_get_value_string_latin1",
    "napi_get_value_string_utf8",
    "napi_get_value_string_utf16",
    "napi_coerce_to_bool",
    "napi_coerce_to_number",
    "napi_coerce_to_object",
    "napi_coerce_to_string",
    "napi_get_prototype",
    "napi_get_property_names",
    "napi_set_property",
    "napi_has_property",
    "napi_get_property",
    "napi_delete_property",
    "napi_has_own_property",
    "napi_set_named_property",
    "napi_has_named_property",
    "napi_get_named_property",
    "napi_set_element",
    "napi_has_element",
    "napi_get_element",
    "napi_delete_element",
    "napi_define_properties",
    "napi_is_array",
    "napi_get_array_length",
    "napi_strict_equals",
    "napi_call_function",
    "napi_new_instance",
    "napi_instanceof",
    "napi_get_cb_info",
    "napi_get_new_target",
    "napi_define_class",
    "napi_wrap",
    "napi_unwrap",
    "napi_remove_wrap",
    "napi_create_external",
    "napi_get_value_external",
    "napi_create_reference",
    "napi_delete_reference",
    "napi_reference_ref",
    "napi_reference_unref",
    "napi_get_reference_value",
    "napi_open_handle_scope",
    "napi_close_handle_scope",
    "napi_open_escapable_handle_scope",
    "napi_close_escapable_handle_scope",
    "napi_escape_handle",
    "napi_throw",
    "napi_throw_error",
    "napi_throw_type_error",
    "napi_throw_range_error",
    "node_api_throw_syntax_error",
    "napi_is_error",
    "napi_is_exception_pending",
    "napi_get_and_clear_last_exception",
    "napi_is_arraybuffer",
    "napi_create_arraybuffer",
    "napi_create_external_arraybuffer",
    "napi_get_arraybuffer_info",
    "napi_is_typedarray",
    "napi_create_typedarray",
    "napi_get_typedarray_info",
    "napi_create_dataview",
    "napi_is_dataview",
    "napi_get_dataview_info",
    "napi_get_version",
    "napi_create_promise",
    "napi_resolve_deferred",
    "napi_reject_deferred",
    "napi_is_promise",
    "napi_run_script",
    "napi_adjust_external_memory",
    "napi_create_date",
    "napi_is_date",
    "napi_get_date_value",
    "napi_add_finalizer",
    "napi_create_bigint_int64",
    "napi_create_bigint_uint64",
    "napi_create_bigint_words",
    "napi_get_value_bigint_int64",
    "napi_get_value_bigint_uint64",
    "napi_get_value_bigint_words",
    "napi_get_all_property_names",
    "napi_set_instance_data",
    "napi_get_instance_data",
    "napi_detach_arraybuffer",
    "napi_is_detached_arraybuffer",
    "napi_type_tag_object",
    "napi_check_object_type_tag",
    "napi_object_freeze",
    "napi_object_seal",
    "napi_async_init",
    "napi_async_destroy",
    "napi_make_callback",
    "napi_create_buffer",
    "napi_create_external_buffer",
    "napi_create_buffer_copy",
    "napi_is_buffer",
    "napi_get_buffer_info",
    "napi_create_async_work",
    "napi_delete_async_work",
    "napi_queue_async_work",
    "napi_cancel_async_work",
    "napi_get_node_version",
    "napi_get_uv_event_loop",
    "napi_fatal_exception",
    "napi_add_env_cleanup_hook",
    "napi_remove_env_cleanup_hook",
    "napi_open_callback_scope",
    "napi_close_callback_scope",
    "napi_create_threadsafe_function",
    "napi_get_threadsafe_function_context",
    "napi_call_threadsafe_function",
    "napi_acquire_threadsafe_function",
    "napi_release_threadsafe_function",
    "napi_unref_threadsafe_function",
    "napi_ref_threadsafe_function",
    "napi_add_async_cleanup_hook",
};

BOOL WINAPI DllMain(HINSTANCE instance, 
                    DWORD reason, 
                    LPVOID reserved) {
    if (reason == DLL_PROCESS_ATTACH) {
        HMODULE executable = GetModuleHandle(NULL);
        for (int i = 0; i < NAPI_FUNC_COUNT; i++) {
            func_ptrs[i] = GetProcAddress(executable, func_names[i]);
        }
    }
    return TRUE;
}
