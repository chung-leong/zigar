#include "addon.h"
#include <stdio.h>
#include <stdarg.h>

int module_count = 0;
int buffer_count = 0;
int function_count = 0;

enum {
    captureView,
    castView,
    readSlot,
    writeSlot,
    beginStructure,
    attachMember,
    attachTemplate,
    defineStructure,
    endStructure,
    createTemplate,
    handleJsCall,
    releaseFunction,
    writeBytes,
};

bool call_js_function(module_data* md,
                      size_t index,
                      size_t argc,
                      const napi_value* argv,
                      napi_value* dest) {
    napi_env env = md->env;
    napi_value fn;
    napi_value null;
    return napi_get_reference_value(env, md->js_fns[index], &fn) == napi_ok
        && napi_get_null(env, &null) == napi_ok
        && napi_call_function(env, null, fn, argc, argv, dest) == napi_ok;
}

void reference_module(module_data* md) {
    md->ref_count++;
}

module_data* new_module(napi_env env) {
    module_data* md = (module_data*) calloc(1, sizeof(module_data));
    md->env = env;
    md->ref_count = 1;
    module_count++;
    return md;
}

void release_module(napi_env env,
                    module_data* md) {
    md->ref_count--;
    if (md->ref_count == 0) {
        for (int i = 0; i < IMPORT_COUNT; i++) {
            napi_delete_reference(env, md->js_fns[i]);
        }
        if (md->so_handle) {
            if (md->mod) {
                md->mod->imports->deinitialize();
            }
            dlclose(md->so_handle);
        }
        free(md);
        module_count--;
    }
}

void finalize_external_buffer(napi_env env,
                              void* finalize_data,
                              void* finalize_hint) {
    release_module(env, (module_data*) finalize_hint);
    buffer_count--;
}

result capture_string(module_data* md,
                      const memory* mem,
                      napi_value* dest) {
    napi_env env = md->env;
    if (napi_create_string_utf8(env, (const char*) mem->bytes, mem->len, dest) == napi_ok) {
        return OK;
    }
    return FAILURE;
}

result capture_view(module_data* md,
                    const memory* mem,
                    size_t handle,
                    napi_value* dest) {
    napi_env env = md->env;
    napi_value args[4];
    uintptr_t pi_handle = (handle) ? handle - md->base_address : 0;
    if (napi_create_uintptr(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
     && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
     && napi_get_boolean(env, mem->attributes.is_comptime, &args[2]) == napi_ok
     && napi_create_uintptr(env, pi_handle, &args[3]) == napi_ok
     && call_js_function(md, captureView, 4, args, dest)) {
        return OK;
    }
    return FAILURE;
}

result cast_view(module_data* md,
                 const memory* mem,
                 napi_value structure,
                 size_t handle,
                 napi_value* dest) {
    napi_env env = md->env;
    napi_value args[5] = { NULL, NULL, NULL, structure, NULL };
    uintptr_t pi_handle = (handle) ? handle - md->base_address : 0;
    if (napi_create_uintptr(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
     && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
     && napi_get_boolean(env, mem->attributes.is_comptime, &args[2]) == napi_ok
     && napi_create_uintptr(env, pi_handle, &args[4]) == napi_ok
     && call_js_function(md, castView, 5, args, dest)) {
        return OK;
    }
    return FAILURE;
}

result read_slot(module_data* md,
                 napi_value object,
                 size_t slot,
                 napi_value* dest) {
    napi_env env = md->env;
    napi_value args[2] = { object };
    napi_value result;
    napi_valuetype type;
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(md, readSlot, 2, args, &result)
     && napi_typeof(env, result, &type) == napi_ok
     && type != napi_undefined) {
        *dest = result;
        return OK;
    }
    return FAILURE;
}

result write_slot(module_data* md,
                  napi_value object,
                  size_t slot,
                  napi_value value) {
    napi_env env = md->env;
    if (!value) {
        if (napi_get_null(env, &value) != napi_ok) {
            return FAILURE;
        }
    }
    napi_value args[3] = { object, NULL, value };
    napi_value result;
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(md, writeSlot, 3, args, &result)) {
        return OK;
    }
    return FAILURE;
}

result begin_structure(module_data* md,
                       const structure* s,
                       napi_value* dest) {
    napi_env env = md->env;
    napi_value args[1];
    napi_value type, flags, signature, length, byte_size, align, name;
    if (napi_create_object(env, &args[0]) == napi_ok
     && napi_create_uint32(env, s->type, &type) == napi_ok
     && napi_set_named_property(env, args[0], "type", type) == napi_ok
     && napi_create_uint32(env, s->flags, &flags) == napi_ok
     && napi_set_named_property(env, args[0], "flags", flags) == napi_ok
     && napi_create_bigint_uint64(env, s->signature, &signature) == napi_ok
     && napi_set_named_property(env, args[0], "signature", signature) == napi_ok
     && (s->length == MISSING(size_t) || napi_create_uint32(env, s->length, &length) == napi_ok)
     && (s->length == MISSING(size_t) || napi_set_named_property(env, args[0], "length", length) == napi_ok)
     && (s->byte_size == MISSING(size_t)  || napi_create_uint32(env, s->byte_size, &byte_size) == napi_ok)
     && (s->byte_size == MISSING(size_t) || napi_set_named_property(env, args[0], "byteSize", byte_size) == napi_ok)
     && (s->align == MISSING(uint16_t) || napi_create_uint32(env, s->align, &align) == napi_ok)
     && (s->align == MISSING(uint16_t) || napi_set_named_property(env, args[0], "align", align) == napi_ok)
     && (!s->name || napi_create_string_utf8(env, s->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!s->name || napi_set_named_property(env, args[0], "name", name) == napi_ok)
     && call_js_function(md, beginStructure, 1, args, dest)) {
        return OK;
     }
     return FAILURE;
}

result attach_member(module_data* md,
                     napi_value structure,
                     const member* m,
                     bool is_static) {
    napi_env env = md->env;
    napi_value args[3] = { structure };
    napi_value result;
    napi_value type, flags, is_required, bit_size, bit_offset, byte_size, slot, name;
    if (napi_create_object(env, &args[1]) == napi_ok
     && napi_get_boolean(env, is_static, &args[2]) == napi_ok
     && napi_create_uint32(env, m->type, &type) == napi_ok
     && napi_set_named_property(env, args[1], "type", type) == napi_ok
     && napi_create_uint32(env, m->flags, &flags) == napi_ok
     && napi_set_named_property(env, args[1], "flags", flags) == napi_ok
     && (m->bit_size == MISSING(size_t) || napi_create_uint32(env, m->bit_size, &bit_size) == napi_ok)
     && (m->bit_size == MISSING(size_t) || napi_set_named_property(env, args[1], "bitSize", bit_size) == napi_ok)
     && (m->bit_offset == MISSING(size_t) || napi_create_uint32(env, m->bit_offset, &bit_offset) == napi_ok)
     && (m->bit_offset == MISSING(size_t) || napi_set_named_property(env, args[1], "bitOffset", bit_offset) == napi_ok)
     && (m->byte_size == MISSING(size_t) || napi_create_uint32(env, m->byte_size, &byte_size) == napi_ok)
     && (m->byte_size == MISSING(size_t) || napi_set_named_property(env, args[1], "byteSize", byte_size) == napi_ok)
     && (m->slot == MISSING(size_t) || napi_create_uint32(env, m->slot, &slot) == napi_ok)
     && (m->slot == MISSING(size_t) || napi_set_named_property(env, args[1], "slot", slot) == napi_ok)
     && (!m->name || napi_create_string_utf8(env, m->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!m->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
     && (!m->structure || napi_set_named_property(env, args[1], "structure", m->structure) == napi_ok)
     && call_js_function(md, attachMember, 3, args, &result)) {
        return OK;
     }
     return FAILURE;
}

result attach_template(module_data* md,
                       napi_value structure,
                       napi_value template_obj,
                       bool is_static) {
    napi_env env = md->env;
    napi_value args[3] = { structure, template_obj };
    napi_value result;
    if (napi_get_boolean(env, is_static, &args[2]) == napi_ok
     && call_js_function(md, attachTemplate, 3, args, &result)) {
        return OK;
    }
    return FAILURE;
}

result define_structure(module_data* md,
                        napi_value structure,
                        napi_value *dest) {
    napi_env env = md->env;
    napi_value args[1] = { structure };
    napi_value result;
    if (call_js_function(md, defineStructure, 1, args, &result)) {
        return OK;
    }
    return FAILURE;
}

result end_structure(module_data* md,
                     napi_value structure) {
    napi_env env = md->env;
    napi_value args[1] = { structure };
    napi_value result;
    if (call_js_function(md, endStructure, 1, args, &result)) {
        return OK;
    }
    return FAILURE;
}

result create_template(module_data* md,
                       napi_value dv,
                       napi_value* dest) {
    napi_env env = md->env;
    napi_value args[1] = { dv };
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && call_js_function(md, createTemplate, 1, args, dest)) {
        return OK;
    }
    return FAILURE;
}

napi_value get_undefined(napi_env env) {
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value throw_error(napi_env env,
                       const char *err_message,
                       ...) {
    napi_value last;
    napi_get_and_clear_last_exception(env, &last);
    char buffer[1024];
    va_list args;
    va_start (args, err_message);
    if (err_message) {
        vsnprintf(buffer, sizeof(buffer), err_message, args);
    } else {
        strcpy(buffer, "Unknown error");
    }
    napi_throw_error((env), NULL, buffer);
    va_end (args);
    return get_undefined(env);
}

napi_value throw_last_error(napi_env env) {
    const napi_extended_error_info* error_info = NULL;
    napi_get_last_error_info(env, &error_info);
    return throw_error(env, error_info->error_message);
}

napi_value get_module_attributes(napi_env env,
                                 napi_callback_info info) {
    module_data* md;
    size_t argc = 0;
    napi_value args[0];
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok) {
        return throw_last_error(env);
    }
    napi_value value;
    napi_create_uint32(env, md->mod->attributes.numeric, &value);
    return value;
}

napi_value get_buffer_address(napi_env env,
                              napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    void* bytes;
    // check arguments
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok
     || napi_get_arraybuffer_info(env, args[0], &bytes, NULL) != napi_ok) {
        return throw_error(env, "Argument must be ArrayBuffer");
    }
    napi_value address;
    if (napi_create_uintptr(env, (uintptr_t) bytes, &address) != napi_ok) {
        return throw_last_error(env);
    }
    return address;
}

bool can_create_external_buffer(napi_env env) {
    static bool checked = false;
    static bool can_create = false;
    if (!checked) {
        char src[4];
        napi_value buffer;
        if (napi_create_external_arraybuffer(env, src, 4, NULL, NULL, &buffer) == napi_ok) {
            can_create = true;
        }
        checked = true;
    }
    return can_create;
}

napi_value obtain_external_buffer(napi_env env,
                                  napi_callback_info info) {
    module_data* md;
    size_t argc = 3;
    napi_value args[3];
    uintptr_t address;
    double len_float;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uintptr(env, args[0], &address) != napi_ok) {
        return throw_error(env, "Address must be "UINTPTR_JS_TYPE);
    } else if (napi_get_value_double(env, args[1], &len_float) != napi_ok) {
        return throw_error(env, "Length must be number");
    }
    napi_value buffer;
    void* src = (void*) address;
    void* dest;
    // need to include at least one byte
    size_t len = len_float;
    if (can_create_external_buffer(env)) {
        if (napi_create_external_arraybuffer(env, src, len, finalize_external_buffer, md, &buffer) != napi_ok) {
            return throw_last_error(env);
        }
    } else {
        // make copy of external memory instead
        void* copy;
        if (napi_create_arraybuffer(env, len, &copy, &buffer) != napi_ok
         || napi_add_finalizer(env, buffer, NULL, finalize_external_buffer, md, NULL) != napi_ok) {
            return throw_last_error(env);
        }
        memcpy(copy, src, len);
        // attach address as fallback property
        napi_value key = args[2];
        napi_value value;
        if (napi_create_uintptr(env, address, &value) != napi_ok
         || napi_set_property(env, buffer, key, value) != napi_ok) {
            return throw_last_error(env);
        }
    }
    // create a reference to the module so that the shared library doesn't get unloaded
    // while the external buffer is still around pointing to it
    reference_module(md);
    buffer_count++;
    return buffer;
}

napi_value copy_external_bytes(napi_env env,
                               napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    void* dest;
    size_t dest_len;
    uintptr_t address;
    double len;
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok
     || napi_get_dataview_info(env, args[0], &dest_len, &dest, NULL, NULL) != napi_ok) {
        return throw_error(env, "Destination must be DataView");
    } else if (napi_get_value_uintptr(env, args[1], &address) != napi_ok) {
        return throw_error(env, "Address must be "UINTPTR_JS_TYPE);
    } else if (napi_get_value_double(env, args[2], &len) != napi_ok) {
        return throw_error(env, "Length must be number");
    } else if (dest_len != len) {
        return throw_error(env, "Length mismatch");
    }
    void* src = (void*) address;
    memcpy(dest, src, dest_len);
    return get_undefined(env);
}

napi_value find_sentinel(napi_env env,
                         napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    void* sentinel_data;
    size_t sentinel_len;
    uintptr_t address;
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok
     || napi_get_value_uintptr(env, args[0], &address) != napi_ok) {
        return throw_error(env, "Address must be "UINTPTR_JS_TYPE);
    } else if (napi_get_dataview_info(env, args[1], &sentinel_len, &sentinel_data, NULL, NULL) != napi_ok) {
        return throw_error(env, "Sentinel value must be DataView");
    }
    if (address && sentinel_len > 0) {
        if (address) {
            uint8_t* sentinel_bytes = (uint8_t*) sentinel_data;
            uint8_t* src_bytes = (uint8_t*) address;
            for (size_t i = 0, j = 0; i < INT32_MAX; i += sentinel_len, j++) {
                if (memcmp(src_bytes + i, sentinel_bytes, sentinel_len) == 0) {
                    napi_value offset;
                    if (napi_create_uint32(env, j, &offset) != napi_ok) {
                        return throw_last_error(env);
                    }
                    return offset;
                }
            }
        }
    }
    napi_value negative_one;
    if (napi_create_int32(env, -1, &negative_one) != napi_ok) {
        return throw_last_error(env);
    }
    return negative_one;
}

napi_value get_factory_thunk(napi_env env,
                             napi_callback_info info) {
    module_data* md;
    if (napi_get_cb_info(env, info, NULL, NULL, NULL, (void*) &md) != napi_ok) {
        return throw_last_error(env);
    }
    uintptr_t thunk_address;
    if (md->mod->imports->get_factory_thunk(&thunk_address) != OK) {
        return throw_error(env, "Unable to define structures");
    }
    napi_value result;
    if (napi_create_uintptr(env, thunk_address, &result) != napi_ok) {
        return throw_last_error(env);
    }
    return result;
}

napi_value run_thunk(napi_env env,
                     napi_callback_info info) {
    module_data* md;
    size_t argc = 3;
    napi_value args[3];
    uintptr_t thunk_address;
    uintptr_t fn_address;
    uintptr_t arg_address;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uintptr(env, args[0], &thunk_address) != napi_ok) {
        return throw_error(env, "Thunk address must be a number");
    } else if (napi_get_value_uintptr(env, args[1], &fn_address) != napi_ok) {
        return throw_error(env, "Function address must be a number");
    } else if (napi_get_value_uintptr(env, args[2], &arg_address) != napi_ok) {
        return throw_error(env, "Argument address must be a number");
    }
    bool success = md->mod->imports->run_thunk(thunk_address, fn_address, arg_address) == OK;
    napi_value retval = NULL;
    napi_get_boolean(env, success, &retval);
    return retval;
}

napi_value run_variadic_thunk(napi_env env,
                              napi_callback_info info) {
    module_data* md;
    size_t argc = 5;
    napi_value args[5];
    uintptr_t thunk_address;
    uintptr_t fn_address;
    uintptr_t arg_address;
    uintptr_t attr_address;
    uint32_t attr_len;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uintptr(env, args[0], &thunk_address) != napi_ok) {
        return throw_error(env, "Thunk address must be a number");
    } else if (napi_get_value_uintptr(env, args[1], &fn_address) != napi_ok) {
        return throw_error(env, "Function address must be a number");
    } else if (napi_get_value_uintptr(env, args[2], &arg_address) != napi_ok) {
        return throw_error(env, "Argument address must be a number");
    } else if (napi_get_value_uintptr(env, args[3], &attr_address) != napi_ok) {
        return throw_error(env, "Attribute address must be a number");
    } else if (napi_get_value_uint32(env, args[4], &attr_len) != napi_ok) {
        return throw_error(env, "Attribute length must be a number");
    }
    napi_value result;
    bool success = md->mod->imports->run_variadic_thunk(thunk_address, fn_address, arg_address, attr_address, attr_len) == OK;
    napi_value retval = NULL;
    napi_get_boolean(env, success, &retval);
    return retval;
}

napi_value create_js_thunk(napi_env env,
                           napi_callback_info info) {
    module_data* md;
    size_t argc = 2;
    napi_value args[2];
    uintptr_t controller_address;
    uint32_t fn_id;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uintptr(env, args[0], &controller_address) != napi_ok) {
        return throw_error(env, "Thunk address must be a number");
    } else if (napi_get_value_uint32(env, args[1], &fn_id) != napi_ok) {
        return throw_error(env, "Function id must be a number");
    }
    size_t thunk_address;
    napi_value result;
    if (md->mod->imports->create_js_thunk(controller_address, fn_id, &thunk_address) != OK
     || napi_create_uintptr(env, thunk_address, &result) != napi_ok) {
        napi_create_uintptr(env, 0, &result);
    }
    return result;
}

napi_value destroy_js_thunk(napi_env env,
                            napi_callback_info info) {
    module_data* md;
    size_t argc = 2;
    napi_value args[2];
    uintptr_t controller_address;
    uintptr_t fn_address;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uintptr(env, args[0], &controller_address) != napi_ok) {
        return throw_error(env, "Thunk address must be a number");
    } else if (napi_get_value_uintptr(env, args[1], &fn_address) != napi_ok) {
        return throw_error(env, "Function address must be a number");
    }
    size_t fn_id;
    napi_value result;
    if (md->mod->imports->destroy_js_thunk(controller_address, fn_address, &fn_id) != OK
     || napi_create_uint32(env, fn_id, &result) != napi_ok) {
        napi_create_uint32(env, 0, &result);
    }
    return result;
}

napi_value recreate_address(napi_env env,
                            napi_callback_info info) {
    module_data* md;
    size_t argc = 1;
    napi_value args[1];
    double handle;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_double(env, args[0], &handle) != napi_ok) {
        return throw_error(env, "Handle must be a number");
    }
    size_t address_value;
    md->mod->imports->get_export_address(md->base_address + handle, &address_value);
    napi_value address;
    if (napi_create_uintptr(env, address_value, &address) != napi_ok) {
        return throw_last_error(env);
    }
    return address;
}

napi_value finalize_async_call(napi_env env,
                               napi_callback_info info) {
    module_data* md;
    size_t argc = 2;
    napi_value args[2];
    size_t futex_handle;
    uint32_t result;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uintptr(env, args[0], &futex_handle) != napi_ok) {
        return throw_error(env, "Futex handle must be a number");
    } else if (napi_get_value_uint32(env, args[1], &result) != napi_ok) {
        return throw_error(env, "Result must be a number");
    }
    if (md->mod->imports->wake_caller(futex_handle, result) != OK) {
        return throw_error(env, "Unable to wake caller");
    }
    return get_undefined(env);
}

#define MEMBER_TYPE_INT     2
#define MEMBER_TYPE_UINT    3
#define MEMBER_TYPE_FLOAT   4

napi_value get_numeric_value(napi_env env,
                             napi_callback_info info) {
    module_data* md;
    size_t argc = 3;
    napi_value args[3];
    uint32_t type;
    uint32_t bits;
    uintptr_t address;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uint32(env, args[0], &type) != napi_ok) {
        return throw_error(env, "Type must be a number");
    } else if (napi_get_value_uint32(env, args[1], &bits) != napi_ok) {
        return throw_error(env, "Bits must be a number");
    } else if (napi_get_value_uintptr(env, args[2], &address) != napi_ok) {
        return throw_error(env, "Address must be a number");
    }
    void* ptr = (void *) address;
    napi_status status = napi_invalid_arg;
    napi_value value;
    switch (type) {
        case MEMBER_TYPE_INT:
            switch (bits) {
                case 8: status = napi_create_int32(env, *((int8_t *) ptr), &value); break;
                case 16: status = napi_create_int32(env, *((int16_t *) ptr), &value); break;
                case 32: status = napi_create_int32(env, *((int32_t *) ptr), &value); break;
                case 64: status = napi_create_bigint_int64(env, *((int64_t *) ptr), &value); break;
            }
            break;
        case MEMBER_TYPE_UINT:
            switch (bits) {
                case 8: status = napi_create_uint32(env, *((uint8_t *) ptr), &value); break;
                case 16: status = napi_create_uint32(env, *((uint16_t *) ptr), &value); break;
                case 32: status = napi_create_uint32(env, *((uint32_t *) ptr), &value); break;
                case 64: status = napi_create_bigint_uint64(env, *((uint64_t *) ptr), &value); break;
            }
            break;
        case MEMBER_TYPE_FLOAT:
            switch (bits) {
                case 32: status = napi_create_double(env, *((float *) ptr), &value); break;
                case 64: status = napi_create_double(env, *((double *) ptr), &value); break;
            }
            break;
    }
    return (status == napi_ok) ? value : throw_last_error(env);
}

napi_value set_numeric_value(napi_env env,
                             napi_callback_info info) {
    module_data* md;
    size_t argc = 4;
    napi_value args[4];
    uint32_t type;
    uint32_t bits;
    uintptr_t address;
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_uint32(env, args[0], &type) != napi_ok) {
        return throw_error(env, "Type must be a number");
    } else if (napi_get_value_uint32(env, args[1], &bits) != napi_ok) {
        return throw_error(env, "Bits must be a number");
    } else if (napi_get_value_uintptr(env, args[2], &address) != napi_ok) {
        return throw_error(env, "Address must be a number");
    }
    void* ptr = (void *) address;
    napi_status status = napi_invalid_arg;
    switch (type) {
        case MEMBER_TYPE_INT:
            if (bits == 64) {
                int64_t value;
                bool lossless;
                status = napi_get_value_bigint_int64(env, args[3], &value, &lossless);
                if (status == napi_ok) {
                    *((int64_t *) ptr) = value;
                }
            } else {
                int32_t value;
                status = napi_get_value_int32(env, args[3], &value);
                if (status == napi_ok) {
                    switch (bits) {
                        case 8: *((int8_t *) ptr) = value; break;
                        case 16: *((int16_t *) ptr) = value; break;
                        case 32: *((int32_t *) ptr) = value; break;
                    }
                }
            }
            break;
        case MEMBER_TYPE_UINT:
            if (bits == 64) {
                uint64_t value;
                bool lossless;
                status = napi_get_value_bigint_uint64(env, args[3], &value, &lossless);
                if (status == napi_ok) {
                    *((uint64_t *) ptr) = value;
                }
            } else {
                uint32_t value;
                status = napi_get_value_uint32(env, args[3], &value);
                if (status == napi_ok) {
                    switch (bits) {
                        case 8: *((uint8_t *) ptr) = value; break;
                        case 16: *((uint16_t *) ptr) = value; break;
                        case 32: *((uint32_t *) ptr) = value; break;
                    }
                }
            }
            break;
        case MEMBER_TYPE_FLOAT: {
            double value;
            status = napi_get_value_double(env, args[3], &value);
            if (status == napi_ok) {
                switch (bits) {
                    case 32: *((float *) ptr) = value; break;
                    case 64: *((double *) ptr) = value; break;
                }
            }
        }   break;
    }
    return (status == napi_ok) ? NULL : throw_last_error(env);
}

napi_value require_buffer_fallback(napi_env env,
                                   napi_callback_info info) {
    napi_value result;
    bool can_create = can_create_external_buffer(env);
    if (napi_get_boolean(env, !can_create, &result) == napi_ok) {
        return result;
    }
    return get_undefined(env);
}

napi_value sync_external_buffer(napi_env env,
                                napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    napi_value value;
    void* bytes;
    // check arguments
    size_t len;
    uintptr_t address;
    bool to;
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok
     || napi_get_arraybuffer_info(env, args[0], &bytes, &len) != napi_ok) {
        return throw_error(env, "Argument must be ArrayBuffer");
    } else if (napi_get_value_uintptr(env, args[1], &address) != napi_ok) {
        return throw_error(env, "Address must be a number");
    } else if (napi_get_value_bool(env, args[2], &to) != napi_ok) {
        return throw_error(env, "To must be a boolean");
    }
    if (to) {
        memcpy((void*) address, bytes, len);
    } else {
        memcpy(bytes, (void*) address, len);
    }
    return get_undefined(env);
}

result handle_js_call(module_data* md,
                      const js_call* call,
                      bool in_main_thread) {
    if (in_main_thread) {
        napi_env env = md->env;
        napi_value args[4];
        napi_value result;
        uint32_t status;
        if (napi_create_uint32(env, call->fn_id, &args[0]) == napi_ok
         && napi_create_uintptr(env, call->arg_address, &args[1]) == napi_ok
         && napi_create_uint32(env, call->arg_size, &args[2]) == napi_ok
         && napi_create_uintptr(env, call->futex_handle, &args[3]) == napi_ok) {
            if (call_js_function(md, handleJsCall, 4, args, &result)
             && napi_get_value_uint32(env, result, &status) == napi_ok) {
                return status;
            }
        }
    } else {
        if (!md->ts_handle_js_call) {
            return FAILURE_DISABLED;
        }
        if (napi_call_threadsafe_function(md->ts_handle_js_call, (void *) call, napi_tsfn_nonblocking) == napi_ok) {
            return OK;
        }
    }
    return FAILURE;
}

void handle_js_call_cb(napi_env env,
                       napi_value js_callback,
                       void* context,
                       void* data) {
    module_data* md = (module_data*) context;
    js_call* call = (js_call*) data;
    result status = handle_js_call(md, call, true);
    if (status != OK) {
        // need to wake caller since JS code won't do it
        md->mod->imports->wake_caller(call->futex_handle, status);
    }
}

result release_function(module_data* md,
                        size_t fn_id,
                        bool in_main_thread) {
    if (in_main_thread) {
        napi_env env = md->env;
        napi_value args[1];
        napi_value result;
        if (napi_create_uint32(env, fn_id, &args[0]) == napi_ok
         && call_js_function(md, releaseFunction, 1, args, &result)) {
            return OK;
        }
    } else {
        if (!md->ts_release_function) {
            return FAILURE_DISABLED;
        }
        if (napi_call_threadsafe_function(md->ts_release_function, (void*) fn_id, napi_tsfn_nonblocking) == napi_ok) {
            return OK;
        }
    }
    return FAILURE;
}

void release_function_cb(napi_env env,
                         napi_value js_callback,
                         void* context,
                         void* data) {
    module_data* md = (module_data*) context;
    size_t fn_id = (size_t) data;
    release_function(md, fn_id, true);
}

result write_bytes(module_data* md,
                   const memory* mem, 
                   bool in_main_thread) {
    if (in_main_thread) {
        napi_env env = md->env;
        napi_value args[2];
        napi_value result;
        if (napi_create_uintptr(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
         && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
         && call_js_function(md, writeBytes, 2, args, &result)) {
            return OK;
        }        
    } else {
        if (!md->ts_write_bytes) {
            return FAILURE_DISABLED;
        }
        void* data = malloc(sizeof(memory) + mem->len);
        memory* copy = (memory*) data;
        copy->bytes = data + sizeof(memory);
        copy->len = mem->len;
        copy->attributes = mem->attributes;
        memcpy(copy->bytes, mem->bytes, mem->len);
        if (napi_call_threadsafe_function(md->ts_write_bytes, copy, napi_tsfn_nonblocking) == napi_ok) {
            return OK;
        }
    }
    return FAILURE;
}

void write_bytes_cb(napi_env env,
                    napi_value js_callback,
                    void* context,
                    void* data) {
    module_data* md = (module_data*) context;
    const memory* mem = (memory*) data;
    write_bytes(md, mem, true);
    free(data);
}

result disable_multithread(module_data* md,
                           bool in_main_thread) {
    if (in_main_thread) {
        napi_release_threadsafe_function(md->ts_disable_multithread, napi_tsfn_abort);
        napi_release_threadsafe_function(md->ts_handle_js_call, napi_tsfn_abort);
        napi_release_threadsafe_function(md->ts_release_function, napi_tsfn_abort);
        napi_release_threadsafe_function(md->ts_write_bytes, napi_tsfn_abort);
        md->ts_disable_multithread = NULL;
        md->ts_handle_js_call = NULL;
        md->ts_release_function = NULL;
        md->ts_write_bytes = NULL;
    } else {
        if (!md->ts_disable_multithread) {
            return FAILURE_DISABLED;
        }
        napi_call_threadsafe_function(md->ts_disable_multithread, NULL, napi_tsfn_nonblocking);
    }
    return OK;
}

void disable_multithread_cb(napi_env env,
                            napi_value js_callback,
                            void* context,
                            void* data) {
    module_data* md = (module_data*) context;
    disable_multithread(md, true);
}

result enable_multithread(module_data* md,
                          bool in_main_thread) {
    if (in_main_thread) {
        napi_env env = md->env;
        napi_value resource_name;
        if (napi_create_string_utf8(env, "zigar", 5, &resource_name) == napi_ok
         && napi_create_threadsafe_function(env, NULL, NULL, resource_name, 0, 1, NULL, NULL, md, handle_js_call_cb, &md->ts_handle_js_call) == napi_ok
         && napi_create_threadsafe_function(env, NULL, NULL, resource_name, 0, 1, NULL, NULL, md, release_function_cb, &md->ts_release_function) == napi_ok
         && napi_create_threadsafe_function(env, NULL, NULL, resource_name, 0, 1, NULL, NULL, md, write_bytes_cb, &md->ts_write_bytes) == napi_ok
         && napi_create_threadsafe_function(env, NULL, NULL, resource_name, 0, 1, NULL, NULL, md, disable_multithread_cb, &md->ts_disable_multithread) == napi_ok) {
            return OK;
        }
    }
    return FAILURE;
}

void finalize_function(napi_env env,
                       void* finalize_data,
                       void* finalize_hint) {
    release_module(env, (module_data*) finalize_hint);
    function_count--;
}

napi_value load_module(napi_env, napi_callback_info);

struct {
    const char* name;
    napi_callback cb;
} exports[EXPORT_COUNT] = {
    { "loadModule", load_module },
    { "getModuleAttributes", get_module_attributes, },
    { "getBufferAddress", get_buffer_address },
    { "obtainExternBuffer", obtain_external_buffer },
    { "copyExternBytes", copy_external_bytes },
    { "findSentinel", find_sentinel },
    { "getFactoryThunk", get_factory_thunk },
    { "runThunk", run_thunk },
    { "runVariadicThunk", run_variadic_thunk },
    { "createJsThunk", create_js_thunk },
    { "destroyJsThunk", destroy_js_thunk },
    { "recreateAddress", recreate_address },
    { "finalizeAsyncCall", finalize_async_call },
    { "getNumericValue", get_numeric_value },
    { "setNumericValue", set_numeric_value },
    { "requireBufferFallback", require_buffer_fallback },
    { "syncExternalBuffer", sync_external_buffer }
};

struct {
    const char* name;
    int index;
} imports[IMPORT_COUNT] = {
    { "captureView", captureView },
    { "castView", castView },
    { "readSlot", readSlot },
    { "writeSlot", writeSlot },
    { "beginStructure", beginStructure },
    { "attachMember", attachMember },
    { "attachTemplate", attachTemplate },
    { "defineStructure", defineStructure },
    { "endStructure", endStructure },
    { "createTemplate", createTemplate },
    { "handleJsCall", handleJsCall },
    { "releaseFunction", releaseFunction },
    { "writeBytes", writeBytes },
};

bool export_functions(module_data* md,
                      napi_value js_env) {
    napi_env env = md->env;
    napi_value imports;
    napi_value import_fn;
    if (napi_get_named_property(env, js_env, "importFunctions", &import_fn) != napi_ok
     || napi_create_object(env, &imports) != napi_ok) {
        return false;
    }
    for (int i = 0; i < EXPORT_COUNT; i++) {
        napi_value function;
        if (napi_create_function(env, exports[i].name, NAPI_AUTO_LENGTH, exports[i].cb, md, &function) != napi_ok
         || napi_add_finalizer(env, function, (void*) exports[i].name, finalize_function, md, NULL) != napi_ok
         || napi_set_named_property(env, imports, exports[i].name, function) != napi_ok) {
            return false;
        }
        reference_module(md);
        function_count++;
    }
    napi_value result;
    if (napi_call_function(env, js_env, import_fn, 1, &imports, &result) != napi_ok) {
        return false;
    }
    return true;
}

bool import_functions(module_data* md,
                      napi_value js_env) {
    napi_env env = md->env;
    napi_value exports;
    napi_value export_fn;
    napi_value key;
    napi_value args[0];
    if (napi_get_named_property(env, js_env, "exportFunctions", &export_fn) != napi_ok
     || napi_call_function(env, js_env, export_fn, 0, args, &exports) != napi_ok) {
        return false;
    }
    for (int i = 0; i < IMPORT_COUNT; i++) {
        napi_value function;
        if (napi_get_named_property(env, exports, imports[i].name, &function) != napi_ok
         || napi_create_reference(env, function, 1, &md->js_fns[i]) != napi_ok) {
            return false;
        }
    }
    return true;
}

napi_value load_module(napi_env env,
                       napi_callback_info info) {
    module_data* md;
    size_t argc = 1;
    size_t path_len;
    napi_value args[1];
    // check arguments
    if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
     || napi_get_value_string_utf8(env, args[0], NULL, 0, &path_len) != napi_ok) {
        return throw_error(env, "Invalid arguments");
    }

    // load the shared library
    char* path = malloc(path_len + 1);
    napi_get_value_string_utf8(env, args[0], path, path_len + 1, &path_len);
    void* handle = md->so_handle = dlopen(path, RTLD_NOW);
    if (!handle) {
        return throw_error(env, "Unable to load shared library '%s'", path);
    }

    // find the zig module
    void* symbol = dlsym(handle, "zig_module");
    if (!symbol) {
        return throw_error(env, "Unable to find the symbol \"zig_module\"");
    }
    module* mod = md->mod = (module*) symbol;
    if (mod->version != 5) {
        return throw_error(env, "Cached module is compiled for a different version of Zigar (API = %d)", mod->version);
    }

    // set base address
    Dl_info dl_info;
    if (!dladdr(symbol, &dl_info)) {
        return throw_error(env, "Unable to obtain address of shared library");
    }
    md->base_address = (uintptr_t) dl_info.dli_fbase;

    redirect_io_functions(handle, path, mod->imports->override_write);
    free(path);

    // attach exports to module
    export_table* exports = mod->exports;
    exports->capture_string = capture_string;
    exports->capture_view = capture_view;
    exports->cast_view = cast_view;
    exports->read_slot = read_slot;
    exports->write_slot = write_slot;
    exports->begin_structure = begin_structure;
    exports->attach_member = attach_member;
    exports->attach_template = attach_template;
    exports->define_structure = define_structure;
    exports->end_structure = end_structure;
    exports->create_template = create_template;
    exports->enable_multithread = enable_multithread;
    exports->disable_multithread = disable_multithread;
    exports->handle_js_call = handle_js_call;
    exports->release_function = release_function;
    exports->write_bytes = write_bytes;

    // run initializer
    if (mod->imports->initialize(md) != OK) {
        return throw_error(env, "Initialization failed");
    }
    return get_undefined(env);
}

bool compile_javascript(napi_env env,
                        napi_value *dest) {
    // compile the code
    static char addon_js_txt[] = (
        #if UINTPTR_MAX == UINT64_MAX
            #include "./addon.64b.js.txt"
        #else
            #include "./addon.32b.js.txt"
        #endif
    );
    static size_t addon_js_txt_len = sizeof(addon_js_txt) - 1;
    napi_value string;
    return napi_create_string_utf8(env, addon_js_txt, addon_js_txt_len, &string) == napi_ok
        && napi_run_script(env, string, dest) == napi_ok;
}

napi_value create_environment(napi_env env,
                              napi_callback_info info) {
    // compile embedded JavaScript
    napi_value js_module;
    if (!compile_javascript(env, &js_module)) {
        return throw_error(env, "Unable to compile embedded JavaScript");
    }
    // look for the Environment class
    napi_value env_name;
    napi_value create_env;
    if (napi_create_string_utf8(env, "createEnvironment", NAPI_AUTO_LENGTH, &env_name) != napi_ok
     || napi_get_property(env, js_module, env_name, &create_env) != napi_ok) {
        return throw_error(env, "Unable to find the function \"createEnvironment\"");
    }
    // create the environment
    napi_value js_env;
    napi_value null;
    if (napi_get_null(env, &null) != napi_ok
     || napi_call_function(env, null, create_env, 0, NULL, &js_env) != napi_ok) {
        return throw_error(env, "Unable to create runtime environment");
    }
    // export functions to the environment and import functions from it
    module_data* md = new_module(env);
    bool success = export_functions(md, js_env) && import_functions(md, js_env);
    release_module(env, md);
    if (!success) {
        return throw_error(env, "Unable to export/import functions");
    }
    return js_env;
}

napi_value get_gc_statistics(napi_env env,
                             napi_callback_info info) {
    napi_value stats;
    napi_value modules, functions, buffers;
    bool success = napi_create_object(env, &stats) == napi_ok
                && napi_create_int32(env, module_count, &modules) == napi_ok
                && napi_set_named_property(env, stats, "modules", modules) == napi_ok
                && napi_create_int32(env, function_count, &functions) == napi_ok
                && napi_set_named_property(env, stats, "functions", functions) == napi_ok
                && napi_create_int32(env, buffer_count, &buffers) == napi_ok
                && napi_set_named_property(env, stats, "buffers", buffers) == napi_ok;
    if (!success) {
        return throw_last_error(env);
    }
    return stats;
}

bool add_function(napi_env env,
                  napi_value target,
                  const char* name,
                  napi_callback cb,
                  void* data) {
    napi_value function;
    return napi_create_function(env, name, NAPI_AUTO_LENGTH, cb, data, &function) == napi_ok
        && napi_set_named_property(env, target, name, function) == napi_ok;
}

napi_value create_addon(napi_env env) {
    napi_value exports;
    if (napi_create_object(env, &exports) != napi_ok
     || !add_function(env, exports, "createEnvironment", create_environment, NULL)
     || !add_function(env, exports, "getGCStatistics", get_gc_statistics, NULL)) {
        return throw_last_error(env);
    }
    return exports;
}
