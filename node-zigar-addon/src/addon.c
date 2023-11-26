#include "addon.h"

int32_t module_count = 0;
int32_t function_count = 0;
int32_t buffer_count = 0;

module_data* create_module_data(void* so_handle,
                                module_attributes attributes,
                                import_table* imports) {
    module_data* md = (module_data*) calloc(1, sizeof(module_data));
    md->so_handle = so_handle;
    md->attributes = attributes;
    md->imports = imports;
    module_count++;
    return md;
}

void reference_module_data(module_data* md) {
    md->ref_count++;
}

void release_module_data(module_data* md) {
    md->ref_count--;
    if (md->ref_count == 0) {
        dlclose(md->so_handle);
        free(md);
        module_count--;
    }
}

function_data* create_function_data(thunk zig_fn,
                                    method_attributes attributes,
                                    module_data* md) {
    function_data* fd = (function_data*) calloc(1, sizeof(function_data));
    fd->zig_fn = zig_fn;
    fd->attributes = attributes;
    fd->mod_data = md;
    reference_module_data(md);
    function_count++;
    return fd;
}

void free_function_data(function_data* fd) {
    release_module_data(fd->mod_data);
    free(fd);
    function_count--;
}

void finalize_external_buffer(napi_env env,
                              void* finalize_data,
                              void* finalize_hint) {
    release_module_data((module_data*) finalize_hint);
    buffer_count--;
}

bool create_external_buffer(napi_env env,
                            uint8_t* bytes,
                            size_t len,
                            module_data* md,
                            napi_value* dest) {
    reference_module_data(md);
    buffer_count++;
    /* create a reference to the module so that the shared library doesn't get unloaded
       while the external buffer is still around pointing to it */
    return napi_create_external_arraybuffer(env, bytes, len, finalize_external_buffer, md, dest) == napi_ok;
}

napi_value call_zig_function(napi_env env,
                             napi_callback_info info) {
    size_t argc = 1;
    napi_value arg0, this;
    void* data;
    if (napi_get_cb_info(env, info, &argc, &arg0, &this, &data) != napi_ok) {
        return NULL;
    }
    function_data* fd = (function_data*) data;
    void* arg_ptr = NULL;
    napi_get_dataview_info(env, arg0, NULL, &arg_ptr, NULL, NULL);
    call ctx = { env, this, NULL, fd };
    return fd->zig_fn(&ctx, arg_ptr);
}

void finalize_function(napi_env env,
                       void* finalize_data,
                       void* finalize_hint) {
    free_function_data((function_data*) finalize_hint);
}

bool create_thunk_caller_ex(napi_env env,
                            thunk zig_fn,
                            method_attributes attributes,
                            module_data* md,
                            napi_value* dest,
                            function_data** dest2) {
    function_data* fd = create_function_data(zig_fn, attributes, md);
    napi_value fn;
    if (napi_create_function(env, "thunk", 5, call_zig_function, fd, &fn) != napi_ok
     || napi_add_finalizer(env, fn, NULL, finalize_function, fd, NULL) != napi_ok) {
        free_function_data(fd);
        return false;
    }
    *dest = fn;
    if (dest2) {
        *dest2 = fd;
    }
    return true;
}

bool create_thunk_caller(napi_env env,
                         thunk zig_fn,
                         method_attributes attributes,
                         module_data* md,
                         napi_value* dest) {
    return create_thunk_caller_ex(env, zig_fn, attributes, md, dest, NULL);
}

bool load_javascript(napi_env env,
                     napi_value *dest) {
    /* compile the code */
    const char addon_js_txt[] = (
        #include "addon.js.txt"
    );
    napi_value string;
    return napi_create_string_utf8(env, addon_js_txt, sizeof(addon_js_txt) - 1, &string) == napi_ok
        && napi_run_script(env, string, dest) == napi_ok;
}

bool call_js_function(call* ctx,
                      js_function fn_index,
                      size_t argc,
                      const napi_value* argv,
                      napi_value* dest) {
    static const char *js_function_names[env_method_count] = {
        "allocateRelocatableMemory",
        "freeRelocatableMemory",
        "createString",
        "createObject",
        "createView",
        "castView",
        "readSlot",
        "writeSlot",
        "beginStructure",
        "attachMember",
        "attachMethod",
        "attachTemplate",
        "finalizeStructure",
        "createTemplate",
        "writeToConsole",
        "flushConsole",
        "invokeFactory",
    };
    napi_env env = ctx->env;
    module_data* md = ctx->fn_data->mod_data;
    napi_value fn;
    if (md->js_fn_refs[fn_index]) {
        if (napi_get_reference_value(env, md->js_fn_refs[fn_index], &fn) != napi_ok) {
            return false;
        }
    } else {
        const char *js_function_name = js_function_names[fn_index];
        if (napi_get_named_property(env, ctx->js_env, js_function_name, &fn) != napi_ok
         || napi_create_reference(env, fn, 0, &md->js_fn_refs[fn_index]) != napi_ok) {
            return false;
        }
    }
    return napi_call_function(env, ctx->js_env, fn, argc, argv, dest) == napi_ok;
}

result allocate_relocatable_memory(call* ctx,
                                   size_t len,
                                   uint16_t align,
                                   memory* dest) {
    napi_env env = ctx->env;
    napi_value args[2];
    napi_value result;
    void* data;
    if (napi_create_uint32(env, len, &args[0]) == napi_ok
     && napi_create_uint32(env, align, &args[1]) == napi_ok
     && call_js_function(ctx, allocateRelocatableMemory, 2, args, &result)
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

result free_relocatable_memory(call* ctx,
                               const memory* mem) {
    napi_env env = ctx->env;
    napi_value args[3];
    napi_value result;
    if (napi_create_bigint_uint64(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
     && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
     && napi_create_uint32(env, mem->attributes.align, &args[2]) == napi_ok
     && call_js_function(ctx, freeRelocatableMemory, 3, args, &result)) {
        return OK;
    }
    return Failure;
}

result create_string(call* ctx,
                     const memory* mem,
                     napi_value* dest) {
    napi_env env = ctx->env;
    if (napi_create_string_utf8(env, (const char*) mem->bytes, mem->len, dest) == napi_ok) {
        return OK;
    }
    return Failure;
}

result create_object(call* ctx,
                     napi_value structure,
                     napi_value arg,
                     napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[2] = { structure, arg };
    if (call_js_function(ctx, castView, 2, args, dest)) {
        return OK;
    }
    return Failure;
}

result create_view(call* ctx,
                   const memory* mem,
                   napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[3];
    napi_value result;
    if (napi_create_bigint_uint64(env, (uintptr_t) mem->bytes, &args[0]) == napi_ok
     && napi_create_uint32(env, mem->len, &args[1]) == napi_ok
     && napi_get_boolean(env, mem->attributes.is_comptime, &args[2]) == napi_ok
     && call_js_function(ctx, createView, 3, args, dest)) {
        return OK;
    }
    return Failure;
}

result cast_view(call* ctx,
                 napi_value structure,
                 napi_value dv,
                 napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[2] = { structure, dv };
    if (call_js_function(ctx, castView, 2, args, dest)) {
        return OK;
    }
    return Failure;
}

result read_slot(call* ctx,
                 napi_value object,
                 size_t slot,
                 napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[2] = { object };
    napi_value result;
    napi_valuetype type;
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(ctx, readSlot, 2, args, &result)
     && napi_typeof(env, result, &type) == napi_ok
     && type != napi_undefined) {
        *dest = result;
        return OK;
    }
    return Failure;
}

result write_slot(call* ctx,
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
     && call_js_function(ctx, writeSlot, 3, args, &result)) {
        return OK;
    }
    return Failure;
}

bool create_options(napi_env env,
                    module_attributes attributes,
                    napi_value* dest) {
    napi_value little_endian, runtime_safety;
    return napi_create_object(env, dest) == napi_ok
        && napi_get_boolean(env, attributes.little_endian, &little_endian) == napi_ok
        && napi_set_named_property(env, *dest, "littleEndian", little_endian) == napi_ok
        && napi_get_boolean(env, attributes.runtime_safety, &runtime_safety) == napi_ok
        && napi_set_named_property(env, *dest, "runtimeSafety", runtime_safety) == napi_ok;
}

result begin_structure(call* ctx,
                       const structure* s,
                       napi_value* dest) {
    napi_env env = ctx->env;
    if (!ctx->options) {
        /* since options are the same for all structures, we can reuse the same object */
        module_attributes attributes = ctx->fn_data->mod_data->attributes;
        if (!create_options(env, attributes, &ctx->options)) {
            return Failure;
        }
    }
    napi_value args[2] = { NULL, ctx->options};
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
     && call_js_function(ctx, beginStructure, 2, args, dest)) {
        return OK;
     }
     return Failure;
}

result attach_member(call* ctx,
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
     && call_js_function(ctx, attachMember, 3, args, &result)) {
        return OK;
     }
     return Failure;
}

result attach_method(call* ctx,
                     napi_value structure,
                     const method* m,
                     bool is_static_only) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure };
    napi_value result;
    napi_value name, fn;
    module_data* md = ctx->fn_data->mod_data;
    if (napi_create_object(env, &args[1]) == napi_ok
     && napi_get_boolean(env, is_static_only, &args[2]) == napi_ok
     && napi_set_named_property(env, args[1], "argStruct", m->structure) == napi_ok
     && create_thunk_caller(env, m->thunk, m->attributes, md, &fn)
     && napi_set_named_property(env, args[1], "thunk", fn) == napi_ok
     && (!m->name || napi_create_string_utf8(env, m->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!m->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
     && call_js_function(ctx, attachMethod, 3, args, &result)) {
        return OK;
     }
     return Failure;
}

result attach_template(call* ctx,
                       napi_value structure,
                       napi_value template_obj,
                       bool is_static) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure, template_obj };
    napi_value result;
    if (napi_get_boolean(env, is_static, &args[2]) == napi_ok
     && call_js_function(ctx, attachTemplate, 3, args, &result)) {
        return OK;
    }
    return Failure;
}

result finalize_structure(call* ctx,
                          napi_value structure) {
    napi_env env = ctx->env;
    napi_value args[1] = { structure };
    napi_value result;
    if (call_js_function(ctx, finalizeStructure, 1, args, &result)) {
        return OK;
    }
    return Failure;
}

result create_template(call* ctx,
                       napi_value dv,
                       napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[1] = { dv };
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && call_js_function(ctx, createTemplate, 1, args, dest)) {
        return OK;
    }
    return Failure;
}

result write_to_console(call* ctx,
                        napi_value dv) {
    napi_env env = ctx->env;
    napi_value args[1] = { dv };
    napi_value result;
    if (call_js_function(ctx, writeToConsole, 1, args, &result)) {
        return OK;
    }
    return Failure;
}

result flush_console(call* ctx) {
    napi_env env = ctx->env;
    napi_value result;
    if (call_js_function(ctx, flushConsole, 0, NULL, &result)) {
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
    napi_value arg0;
    void* data;
    /* check arguments */
    if (napi_get_cb_info(env, info, &argc, &arg0, NULL, &data) != napi_ok
     || napi_get_arraybuffer_info(env, arg0, &data, NULL) != napi_ok) {
        return throw_error(env, "Argument must be ArrayBuffer");
    }
    napi_value address;
    if (napi_create_bigint_uint64(env, (uintptr_t) data, &address) != napi_ok) {
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
    if (md->imports->allocate_fixed_memory(len, align, &mem) != OK) {
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
    md->imports->free_fixed_memory(&mem);
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

bool override_environment_functions(napi_env env,
                                    napi_value env_constructor,
                                    module_data* md) {
    napi_value prototype;
    return napi_get_named_property(env, env_constructor, "prototype", &prototype) == napi_ok
        && add_function(env, prototype, "extractBufferAddress", extract_buffer_address, md)
        && add_function(env, prototype, "allocateExternalMemory", allocate_external_memory, md)
        && add_function(env, prototype, "freeExternalMemory", free_external_memory, md)
        && add_function(env, prototype, "obtainExternalBuffer", obtain_external_buffer, md)
        && add_function(env, prototype, "copyBytes", copy_bytes, md)
        && add_function(env, prototype, "findSentinel", find_sentinel, md);
}

napi_value load_module(napi_env env,
                       napi_callback_info info) {
    void* data;
    size_t argc = 1;
    size_t path_len;
    napi_value arg0;
    /* check arguments */
    if (napi_get_cb_info(env, info, &argc, &arg0, NULL, &data) != napi_ok
     || napi_get_value_string_utf8(env, arg0, NULL, 0, &path_len) != napi_ok) {
        return throw_error(env, "Invalid arguments");
    }

    /* load the shared library */
    char* path = malloc(path_len + 1);
    napi_get_value_string_utf8(env, arg0, path, path_len + 1, &path_len);
    void* handle = dlopen(path, RTLD_NOW);
    free(path);
    if (!handle) {
        return throw_error(env, "Unable to load shared library");
    }

    /* find the zig module */
    void* symbol = dlsym(handle, "zig_module");
    if (!symbol) {
        return throw_error(env, "Unable to find the symbol \"zig_module\"");
    }

    /* compile embedded JavaScript */
    napi_value js_module;
    if (!load_javascript(env, &js_module)) {
        return throw_error(env, "Unable to compile embedded JavaScript");
    }

    /* look for the Environment class */
    napi_value env_name;
    napi_value env_constructor;
    if (napi_create_string_utf8(env, "Environment", NAPI_AUTO_LENGTH, &env_name) != napi_ok
     || napi_get_property(env, js_module, env_name, &env_constructor) != napi_ok) {
        return throw_error(env, "Unable to find the class \"Environment\"");
    }

    /* attach exports to module */
    module* mod = (module*) symbol;
    if (mod->version != 2) {
        return throw_error(env, "Cached module is compiled for a different version of Zigar");
    }
    export_table* exports = mod->exports;
    exports->allocate_relocatable_memory = allocate_relocatable_memory;
    exports->free_relocatable_memory = free_relocatable_memory;
    exports->create_string = create_string;
    exports->create_object = create_object;
    exports->create_view = create_view;
    exports->cast_view = cast_view;
    exports->read_slot = read_slot;
    exports->write_slot = write_slot;
    exports->begin_structure = begin_structure;
    exports->attach_member = attach_member;
    exports->attach_method = attach_method;
    exports->attach_template = attach_template;
    exports->finalize_structure = finalize_structure;
    exports->create_template = create_template;
    exports->write_to_console = write_to_console;
    exports->flush_console = flush_console;

    /* add functions to Environment class */
    module_data* md = create_module_data(handle, mod->attributes, mod->imports);
    if (!override_environment_functions(env, env_constructor, md)) {
        return throw_error(env, "Unable to modify runtime environment");
    }

    /* create the environment */
    napi_value js_env;
    if (napi_new_instance(env, env_constructor, 0, NULL, &js_env) != napi_ok) {
        return throw_error(env, "Unable to create runtime environment");
    }

    /* invoke the factory thunk through JavaScript */
    method_attributes factory_attrs = { false };
    napi_value caller, result;
    function_data* fd;
    if (!create_thunk_caller_ex(env, mod->factory, factory_attrs, md, &caller, &fd)) {
        return throw_last_error(env);
    }
    call ctx = { env, js_env, NULL, fd };
    if (!call_js_function(&ctx, invokeFactory, 1, &caller, &result)) {
        /* an error should have been thrown already */
        return NULL;
    }
    return result;
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

napi_value create_addon(napi_env env) {
    napi_value exports;
    bool success = napi_create_object(env, &exports) == napi_ok
                && add_function(env, exports, "load", load_module, NULL)
                && add_function(env, exports, "getGCStatistics", get_gc_statistics, NULL);
    if (!success) {
        return throw_last_error(env);
    }
    return exports;
}

