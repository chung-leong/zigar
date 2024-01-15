#include "addon.h"

int module_count = 0;
int buffer_count = 0;
int function_count = 0;

void reference_module(module_data* md) {
    md->ref_count++;
}

module_data* new_module(napi_env env) {
    module_data* md = (module_data*) calloc(1, sizeof(module_data));
    md->ref_count = 1;
    module_count++;
    return md;
}

void release_module(napi_env env,
                    module_data* md) {
    md->ref_count--;
    if (md->ref_count == 0) {
        if (env && md->js_env) {
            napi_value js_env, released;
            if (napi_get_reference_value(env, md->js_env, &js_env) == napi_ok
            && napi_get_boolean(env, true, &released) == napi_ok) {
                /* indicate to the environment that the shared lib has been released */
                napi_set_named_property(env, js_env, "released", released);
            }
        }
        if (md->so_handle) {
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

bool create_external_buffer(napi_env env,
                            uint8_t* bytes,
                            size_t len,
                            module_data* md,
                            napi_value* dest) {
    if (len > 0) {
        reference_module(md);
        buffer_count++;
        /* create a reference to the module so that the shared library doesn't get unloaded
        while the external buffer is still around pointing to it */
        return napi_create_external_arraybuffer(env, bytes, len, finalize_external_buffer, md, dest) == napi_ok;
    } else {
        /* external array buffer cannot be zero-length--return a regular buffer instead */
        return napi_create_arraybuffer(env, len, NULL, dest) == napi_ok;
    }
}

bool load_javascript(napi_env env,
                     napi_value *dest) {
    /* compile the code */
    static const char* addon_js_txt = (
        #include "addon.js.txt"
    );
    /* getting the length of the string this way due to VC throwing "compiler is out of heap space" error
       when addon_js_txt is a char array instead of a pointer */
    static size_t addon_js_txt_len = sizeof(
        #include "addon.js.txt"
    ) - 1;
    napi_value string;
    return napi_create_string_utf8(env, addon_js_txt, addon_js_txt_len, &string) == napi_ok
        && napi_run_script(env, string, dest) == napi_ok;
}

bool call_js_function(call ctx,
                      const char* fn_name,
                      size_t argc,
                      const napi_value* argv,
                      napi_value* dest) {
    napi_env env = ctx->env;
    napi_value fn;
    return napi_get_named_property(env, ctx->js_env, fn_name, &fn) == napi_ok
        && napi_call_function(env, ctx->js_env, fn, argc, argv, dest) == napi_ok;
}

result allocate_host_memory(call ctx,
                            size_t len,
                            uint16_t align,
                            memory* dest) {
    napi_env env = ctx->env;
    napi_value args[2];
    napi_value result;
    void* data;
    if (napi_create_uint32(env, len, &args[0]) == napi_ok
     && napi_create_uint32(env, align, &args[1]) == napi_ok
     && call_js_function(ctx, "allocateHostMemory", 2, args, &result)
     && napi_get_dataview_info(env, result, NULL, &data, NULL, NULL) == napi_ok) {
        dest->bytes = (uint8_t*) data;
        dest->len = len;
        dest->attributes.is_const = false;
        dest->attributes.is_comptime = false;
        dest->attributes.align = align;
        return OK;
    }
    return Failure;
}

result free_host_memory(call ctx,
                        const memory* mem) {
    napi_env env = ctx->env;
    napi_value args[3];
    napi_value result;
    if (napi_create_bigint_uint64(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
     && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
     && napi_create_uint32(env, mem->attributes.align, &args[2]) == napi_ok
     && call_js_function(ctx, "freeHostMemory", 3, args, &result)) {
        return OK;
    }
    return Failure;
}

result capture_string(call ctx,
                      const memory* mem,
                      napi_value* dest) {
    napi_env env = ctx->env;
    if (napi_create_string_utf8(env, (const char*) mem->bytes, mem->len, dest) == napi_ok) {
        return OK;
    }
    return Failure;
}

result capture_view(call ctx,
                    const memory* mem,
                    napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[3];
    napi_value result;
    if (napi_create_bigint_uint64(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
     && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
     && napi_get_boolean(env, mem->attributes.is_comptime, &args[2]) == napi_ok
     && call_js_function(ctx, "captureView", 3, args, dest)) {
        return OK;
    }
    return Failure;
}

result cast_view(call ctx,
                 napi_value structure,
                 napi_value dv,
                 bool writable,
                 napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure, dv };
    if (napi_get_boolean(env, writable, &args[2]) == napi_ok
     && call_js_function(ctx, "castView", 3, args, dest)) {
        return OK;
    }
    return Failure;
}

result read_slot(call ctx,
                 napi_value object,
                 size_t slot,
                 napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[2] = { object };
    napi_value result;
    napi_valuetype type;
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(ctx, "readSlot", 2, args, &result)
     && napi_typeof(env, result, &type) == napi_ok
     && type != napi_undefined) {
        *dest = result;
        return OK;
    }
    return Failure;
}

result write_slot(call ctx,
                  napi_value object,
                  size_t slot,
                  napi_value value) {
    napi_env env = ctx->env;
    if (!value) {
        if (napi_get_null(env, &value) != napi_ok) {
            return Failure;
        }
    }
    napi_value args[3] = { object, NULL, value };
    napi_value result;
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(ctx, "writeSlot", 3, args, &result)) {
        return OK;
    }
    return Failure;
}

result begin_structure(call ctx,
                       const structure* s,
                       napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[1];
    napi_value type, length, byte_size, align, is_const, has_pointer, name;
    bool no_length = !(s->type == Array || s->type == Vector);
    if (napi_create_object(env, &args[0]) == napi_ok
     && napi_create_uint32(env, s->type, &type) == napi_ok
     && napi_set_named_property(env, args[0], "type", type) == napi_ok
     && (no_length || napi_create_uint32(env, s->length, &length) == napi_ok)
     && (no_length || napi_set_named_property(env, args[0], "length", length) == napi_ok)
     && napi_create_uint32(env, s->byte_size, &byte_size) == napi_ok
     && napi_set_named_property(env, args[0], "byteSize", byte_size) == napi_ok
     && napi_create_uint32(env, s->align, &align) == napi_ok
     && napi_set_named_property(env, args[0], "align", align) == napi_ok
     && napi_get_boolean(env, s->is_const, &is_const) == napi_ok
     && napi_set_named_property(env, args[0], "isConst", is_const) == napi_ok
     && napi_get_boolean(env, s->has_pointer, &has_pointer) == napi_ok
     && napi_set_named_property(env, args[0], "hasPointer", has_pointer) == napi_ok
     && (napi_create_string_utf8(env, s->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (napi_set_named_property(env, args[0], "name", name) == napi_ok)
     && call_js_function(ctx, "beginStructure", 1, args, dest)) {
        return OK;
     }
     return Failure;
}

result attach_member(call ctx,
                     napi_value structure,
                     const member* m,
                     bool is_static) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure };
    napi_value result;
    napi_value type, is_required, bit_size, bit_offset, byte_size, slot, name;
    if (napi_create_object(env, &args[1]) == napi_ok
     && napi_get_boolean(env, is_static, &args[2]) == napi_ok
     && napi_create_uint32(env, m->type, &type) == napi_ok
     && napi_set_named_property(env, args[1], "type", type) == napi_ok
     && napi_get_boolean(env, m->is_required, &is_required) == napi_ok
     && napi_set_named_property(env, args[1], "isRequired", is_required) == napi_ok
     && (m->bit_size == MISSING || napi_create_uint32(env, m->bit_size, &bit_size) == napi_ok)
     && (m->bit_size == MISSING || napi_set_named_property(env, args[1], "bitSize", bit_size) == napi_ok)
     && (m->bit_offset == MISSING || napi_create_uint32(env, m->bit_offset, &bit_offset) == napi_ok)
     && (m->bit_offset == MISSING || napi_set_named_property(env, args[1], "bitOffset", bit_offset) == napi_ok)
     && (m->byte_size == MISSING || napi_create_uint32(env, m->byte_size, &byte_size) == napi_ok)
     && (m->byte_size == MISSING || napi_set_named_property(env, args[1], "byteSize", byte_size) == napi_ok)
     && (m->slot == MISSING || napi_create_uint32(env, m->slot, &slot) == napi_ok)
     && (m->slot == MISSING || napi_set_named_property(env, args[1], "slot", slot) == napi_ok)
     && (!m->name || napi_create_string_utf8(env, m->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!m->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
     && (!m->structure || napi_set_named_property(env, args[1], "structure", m->structure) == napi_ok)
     && call_js_function(ctx, "attachMember", 3, args, &result)) {
        return OK;
     }
     return Failure;
}

result attach_method(call ctx,
                     napi_value structure,
                     const method* m,
                     bool is_static_only) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure };
    napi_value result;
    napi_value name, thunk_id;
    // thunk_id from Zig is the function's address--make it relative to the base address
    size_t adjusted_thunk_id = m->thunk_id - ctx->mod_data->base_address;
    if (napi_create_object(env, &args[1]) == napi_ok
     && napi_get_boolean(env, is_static_only, &args[2]) == napi_ok
     && napi_set_named_property(env, args[1], "argStruct", m->structure) == napi_ok
     && napi_create_double(env, adjusted_thunk_id, &thunk_id) == napi_ok
     && napi_set_named_property(env, args[1], "thunkId", thunk_id) == napi_ok
     && (!m->name || napi_create_string_utf8(env, m->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!m->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
     && call_js_function(ctx, "attachMethod", 3, args, &result)) {
        return OK;
     }
     return Failure;
}

result attach_template(call ctx,
                       napi_value structure,
                       napi_value template_obj,
                       bool is_static) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure, template_obj };
    napi_value result;
    if (napi_get_boolean(env, is_static, &args[2]) == napi_ok
     && call_js_function(ctx, "attachTemplate", 3, args, &result)) {
        return OK;
    }
    return Failure;
}

result finalize_shape(call ctx,
                      napi_value structure) {
    napi_env env = ctx->env;
    napi_value args[1] = { structure };
    napi_value result;
    if (call_js_function(ctx, "finalizeShape", 1, args, &result)) {
        return OK;
    }
    return Failure;
}

result end_structure(call ctx,
                     napi_value structure) {
    napi_env env = ctx->env;
    napi_value args[1] = { structure };
    napi_value result;
    if (call_js_function(ctx, "endStructure", 1, args, &result)) {
        return OK;
    }
    return Failure;
}

result create_template(call ctx,
                       napi_value dv,
                       napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[1] = { dv };
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && call_js_function(ctx, "createTemplate", 1, args, dest)) {
        return OK;
    }
    return Failure;
}

result write_to_console(call ctx,
                        napi_value dv) {
    napi_env env = ctx->env;
    napi_value args[1] = { dv };
    napi_value result;
    if (call_js_function(ctx, "writeToConsole", 1, args, &result)) {
        return OK;
    }
    return Failure;
}

napi_value throw_error(napi_env env,
                       const char *err_message) {
    napi_value last;
    napi_get_and_clear_last_exception(env, &last);
    napi_throw_error((env), NULL, err_message ? err_message : "Unknown error");
    return NULL;
}

napi_value throw_last_error(napi_env env) {
    const napi_extended_error_info* error_info = NULL;
    napi_get_last_error_info(env, &error_info);
    return throw_error(env, error_info->error_message);
}

napi_value extract_buffer_address(napi_env env,
                                  napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    void* bytes;
    /* check arguments */
    if (napi_get_cb_info(env, info, &argc, &args[0], NULL, NULL) != napi_ok
     || napi_get_arraybuffer_info(env, args[0], &bytes, NULL) != napi_ok) {
        return throw_error(env, "Argument must be ArrayBuffer");
    }
    napi_value address;
    if (napi_create_bigint_uint64(env, (uintptr_t) bytes, &address) != napi_ok) {
        return throw_last_error(env);
    }
    return address;
}

napi_value allocate_external_memory(napi_env env,
                                    napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    void* data;
    double len;
    uint32_t align;
    if (napi_get_cb_info(env, info, &argc, args, NULL, &data) != napi_ok
     || napi_get_value_double(env, args[0], &len) != napi_ok) {
        return throw_error(env, "Length must be number");
    } else if (napi_get_value_uint32(env, args[1], &align) != napi_ok) {
        return throw_error(env, "Align must be number");
    }
    module_data* md = (module_data*) data;
    memory mem;
    if (md->mod->imports->allocate_extern_memory(len, align, &mem) != OK) {
        return throw_error(env, "Unable to allocate fixed memory");
    }
    napi_value buffer;
    if (!create_external_buffer(env, mem.bytes, mem.len, md, &buffer)) {
        return throw_last_error(env);
    }
    return buffer;
}

napi_value free_external_memory(napi_env env,
                                napi_callback_info info) {
    return NULL;
    size_t argc = 3;
    napi_value args[3];
    void* data;
    uint64_t address;
    bool lossless;
    double len;
    uint32_t align;
    if (napi_get_cb_info(env, info, &argc, args, NULL, &data) != napi_ok
     || napi_get_value_bigint_uint64(env, args[0], &address, &lossless) != napi_ok) {
        return throw_error(env, "Address must be bigint");
    } else if (napi_get_value_double(env, args[1], &len) != napi_ok) {
        return throw_error(env, "Length must be number");
    } else if (napi_get_value_uint32(env, args[2], &align) != napi_ok) {
        return throw_error(env, "Align must be number");
    }
    module_data* md = (module_data*) data;
    memory mem = { (void*) address, len, { align, false, false } };
    md->mod->imports->free_extern_memory(&mem);
}

napi_value obtain_external_buffer(napi_env env,
                                  napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    void* data;
    uint64_t address;
    bool lossless;
    double len;
    if (napi_get_cb_info(env, info, &argc, args, NULL, &data) != napi_ok
     || napi_get_value_bigint_uint64(env, args[0], &address, &lossless) != napi_ok) {
        return throw_error(env, "Address must be bigint");
    } else if (napi_get_value_double(env, args[1], &len) != napi_ok) {
        return throw_error(env, "Length must be number");
    }
    module_data* md = (module_data*) data;
    napi_value buffer;
    if (!create_external_buffer(env, (uint8_t*) address, len, md, &buffer)) {
        return throw_last_error(env);
    }
    return buffer;
}

napi_value copy_bytes(napi_env env,
                      napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    void* dest;
    size_t dest_len;
    uint64_t address;
    bool lossless;
    double len;
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok
     || napi_get_dataview_info(env, args[0], &dest_len, &dest, NULL, NULL) != napi_ok) {
        return throw_error(env, "Destination must be DataView");
    } else if (napi_get_value_bigint_uint64(env, args[1], &address, &lossless) != napi_ok) {
        return throw_error(env, "Address must be bigint");
    } else if (napi_get_value_double(env, args[2], &len) != napi_ok) {
        return throw_error(env, "Length must be number");
    } else if (dest_len != len) {
        return throw_error(env, "Length mismatch");
    }
    void* src = (void*) address;
    memcpy(dest, src, dest_len);
    return NULL;
}

napi_value find_sentinel(napi_env env,
                         napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    void* sentinel_data;
    size_t sentinel_len;
    uint64_t address;
    bool lossless;
    double len;
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok
     || napi_get_value_bigint_uint64(env, args[0], &address, &lossless) != napi_ok) {
        return throw_error(env, "Address must be bigint");
    } else if (napi_get_dataview_info(env, args[1], &sentinel_len, &sentinel_data, NULL, NULL) != napi_ok) {
        return throw_error(env, "Sentinel value must be DataView");
    }
    uint8_t* sentinel_bytes = (uint8_t*) sentinel_data;
    uint8_t* src_bytes = (uint8_t*) address;
    if (sentinel_len > 0) {
      for (int i = 0, j = 0; i < INT32_MAX; i += sentinel_len, j++) {
        if (memcmp(src_bytes + i, sentinel_bytes, sentinel_len) == 0) {
            napi_value offset;
            if (napi_create_uint32(env, j, &offset) != napi_ok) {
                return throw_last_error(env);
            }
            return offset;
        }
      }
    }
    return NULL;
}

napi_value get_factory_thunk(napi_env env,
                             napi_callback_info info) {
    void* data;
    if (napi_get_cb_info(env, info, NULL, NULL, NULL, &data) != napi_ok) {
        return throw_last_error(env);
    }
    module_data* md = (module_data*) data;
    size_t thunk_address;
    if (md->mod->imports->get_factory_thunk(&thunk_address) != OK) {
        return throw_error(env, "Unable to define structures");
    }
    size_t adjusted_thunk_id = thunk_address - md->base_address;
    napi_value thunk_id;
    if (napi_create_double(env, adjusted_thunk_id, &thunk_id) != napi_ok) {
        return throw_last_error(env);
    }
    return thunk_id;
}

napi_value run_thunk(napi_env env,
                     napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_value js_env;
    void* data;
    double thunk_id;
    void* args_ptr;
    if (napi_get_cb_info(env, info, &argc, args, &js_env, &data) != napi_ok
     || napi_get_value_double(env, args[0], &thunk_id) != napi_ok) {
        return throw_error(env, "Thunk id must be a number");
    } else if (napi_get_dataview_info(env, args[1], NULL, &args_ptr, NULL, NULL) != napi_ok) {
        return throw_error(env, "Arguments must be a DataView");
    }
    module_data* md = (module_data*) data;
    call_context ctx = { env, js_env, md };
    size_t thunk_address = md->base_address + thunk_id;
    napi_value result;
    if (md->mod->imports->run_thunk(&ctx, thunk_address, args_ptr, &result) != OK) {
        return throw_error(env, "Unable to execute function");
    }
    return result;
}

napi_value get_memory_offset(napi_env env,
                             napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    void* data;
    uint64_t address;
    bool lossless;
    if (napi_get_cb_info(env, info, &argc, &args[0], NULL, &data) != napi_ok
     || napi_get_value_bigint_uint64(env, args[0], &address, &lossless) != napi_ok) {
        return throw_error(env, "Address must be bigint");
    }
    module_data* md = (module_data*) data;
    size_t base = md->base_address;
    if (address < base) {
        /* this happens when we encounter a regular ArrayBuffer with byteLength = 0 */ 
        address = base;
    }
    napi_value offset;
    if (napi_create_double(env, address - base, &offset) != napi_ok) {
        return throw_last_error(env);
    }
    return offset;
}

napi_value recreate_address(napi_env env,
                            napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    void* data;
    double reloc;
    if (napi_get_cb_info(env, info, &argc, &args[0], NULL, &data) != napi_ok
     || napi_get_value_double(env, args[0], &reloc) != napi_ok) {
        return throw_error(env, "Offset must be a number");
    }
    module_data* md = (module_data*) data;
    size_t base = md->base_address;
    napi_value address;
    if (napi_create_bigint_uint64(env, base + reloc, &address) != napi_ok) {
        return throw_last_error(env);
    }
    return address;
}

void finalize_function(napi_env env,
                       void* finalize_data,
                       void* finalize_hint) {
    release_module(env, (module_data*) finalize_hint);
    function_count--;
}

bool export_function(napi_env env,
                     napi_value js_env,
                     const char* name,
                     napi_callback cb,
                     module_data* md) {
    napi_value function;
    bool success = napi_create_function(env, name, NAPI_AUTO_LENGTH, cb, md, &function) == napi_ok
                && napi_add_finalizer(env, function, (void*) name, finalize_function, md, NULL) == napi_ok
                && napi_set_named_property(env, js_env, name, function) == napi_ok;
    if (success) {
        /* maintain a reference on the module */
        reference_module(md);
        function_count++;
        return true;
    }
    return false;
}

bool export_functions(napi_env env,
                      napi_value js_env,
                      module_data* md) {
    return export_function(env, js_env, "extractBufferAddress", extract_buffer_address, md)
        && export_function(env, js_env, "allocateExternMemory", allocate_external_memory, md)
        && export_function(env, js_env, "freeExternMemory", free_external_memory, md)
        && export_function(env, js_env, "obtainExternBuffer", obtain_external_buffer, md)
        && export_function(env, js_env, "copyBytes", copy_bytes, md)
        && export_function(env, js_env, "findSentinel", find_sentinel, md)
        && export_function(env, js_env, "getFactoryThunk", get_factory_thunk, md)
        && export_function(env, js_env, "runThunk", run_thunk, md)
        && export_function(env, js_env, "getMemoryOffset", get_memory_offset, md)
        && export_function(env, js_env, "recreateAddress", recreate_address, md);
}

bool set_attributes(napi_env env,
                    napi_value js_env,
                    module_data* md) {
    module_attributes attributes = md->mod->attributes;
    napi_value little_endian, runtime_safety;
    return napi_get_boolean(env, attributes.little_endian, &little_endian) == napi_ok
        && napi_set_named_property(env, js_env, "littleEndian", little_endian) == napi_ok
        && napi_get_boolean(env, attributes.runtime_safety, &runtime_safety) == napi_ok
        && napi_set_named_property(env, js_env, "runtimeSafety", runtime_safety) == napi_ok;
}

napi_value load_module(napi_env env,
                       napi_callback_info info) {
    #define failure(msg) error_msg = msg; throw_error(env, msg); goto exit;
    const char* error_msg = NULL;
    module_data* md = new_module(env);
    void* data;
    size_t argc = 1;
    size_t path_len;
    napi_value args[1];
    /* check arguments */
    if (napi_get_cb_info(env, info, &argc, args, NULL, &data) != napi_ok
     || napi_get_value_string_utf8(env, args[0], NULL, 0, &path_len) != napi_ok) {
        failure("Invalid arguments");
    }

    /* load the shared library */
    char* path = malloc(path_len + 1);
    napi_get_value_string_utf8(env, args[0], path, path_len + 1, &path_len);
    void* handle = md->so_handle = dlopen(path, RTLD_NOW);
    free(path);
    if (!handle) {
        failure("Unable to load shared library");
    }

    /* find the zig module */
    void* symbol = dlsym(handle, "zig_module");
    if (!symbol) {
        failure("Unable to find the symbol \"zig_module\"");
    }
    module* mod = md->mod = (module*) symbol;
    if (mod->version != 2) {
        failure("Cached module is compiled for a different version of Zigar");
    }

    /* set base address */
    Dl_info dl_info;
    if (!dladdr(symbol, &dl_info)) {
        failure("Unable to obtain address of shared library");
    }
    md->base_address = (size_t) dl_info.dli_fbase;

#ifdef WIN32
    /* we can't override write() the normal way on Windows
        need to intercept the call to kernel32.dll instead */
    patch_write_file(handle, mod->imports->override_write);
#endif

    /* attach exports to module */
    export_table* exports = mod->exports;
    exports->allocate_host_memory = allocate_host_memory;
    exports->free_host_memory = free_host_memory;
    exports->capture_string = capture_string;
    exports->capture_view = capture_view;
    exports->cast_view = cast_view;
    exports->read_slot = read_slot;
    exports->write_slot = write_slot;
    exports->begin_structure = begin_structure;
    exports->attach_member = attach_member;
    exports->attach_method = attach_method;
    exports->attach_template = attach_template;
    exports->finalize_shape = finalize_shape;
    exports->end_structure = end_structure;
    exports->create_template = create_template;
    exports->write_to_console = write_to_console;

    /* compile embedded JavaScript */
    napi_value js_module;
    if (!load_javascript(env, &js_module)) {
        failure("Unable to compile embedded JavaScript");
    }

    /* look for the Environment class */
    napi_value env_name;
    napi_value env_constructor;
    if (napi_create_string_utf8(env, "Environment", NAPI_AUTO_LENGTH, &env_name) != napi_ok
     || napi_get_property(env, js_module, env_name, &env_constructor) != napi_ok) {
        failure("Unable to find the class \"Environment\"");
    }

    /* create the environment */
    napi_value js_env;   
    if (napi_new_instance(env, env_constructor, 0, NULL, &js_env) != napi_ok) {
        failure("Unable to create runtime environment");
    }

    /* create reference to JavaScript environment */
    if (napi_create_reference(env, js_env, 0, &md->js_env) != napi_ok) {
        failure("Unable to save runtime environment");
    }

    /* add functions and attributes to environment */
    if (!export_functions(env, js_env, md) || !set_attributes(env, js_env, md)) {
        failure("Unable to modify runtime environment");
    }
exit:
    if (error_msg) {
        js_env = throw_error(env, error_msg);
    }
    release_module(env, md);
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
    bool success = napi_create_object(env, &exports) == napi_ok
                && add_function(env, exports, "loadModule", load_module, NULL)
                && add_function(env, exports, "getGCStatistics", get_gc_statistics, NULL);
    if (!success) {
        return throw_last_error(env);
    }
    return exports;
}

