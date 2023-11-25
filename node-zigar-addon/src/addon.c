#include <node_api.h>
#include "addon.h"

napi_value throw_error(napi_env env,
                       const char *err_message) {
    bool is_pending;
    napi_is_exception_pending(env, &is_pending);
    if (!is_pending) {
        napi_throw_error((env), NULL, err_message);
    }
    return NULL;
}

napi_value throw_last_error(napi_env env) {
    const napi_extended_error_info* error_info = NULL;
    napi_get_last_error_info(env, &error_info);
    return throw_error(env, error_info->error_message);

}

bool add_function(napi_env env,
                  napi_value exports,
                  const char *name,
                  napi_callback cb,
                  void* data) {
    napi_value function;
    return napi_create_function(env, name, NAPI_AUTO_LENGTH, cb, data, &function) == napi_ok
        && napi_set_named_property(env, exports, name, function) == napi_ok;
}

bool load_javascript(napi_env env,
                     napi_value *dest) {
    /* compile the code */
    const char* addon_js_txt = (
        #include "addon.js.txt"
    );
    napi_value string;
    return napi_create_string_utf8(env, addon_js_txt, sizeof(addon_js_txt), &string) == napi_ok
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
        "createView",
        "castView",
        "createObject",
        "createTemplate",
        "readSlot",
        "writeSlot",
        "attachMember",
        "attachTemplate",
        "finalizeStructure",
        "writeToConsole",
        "flushConsole",
    };
    napi_env env = ctx->env;
    module_data* md = ctx->fn_data->mod_data;
    if (!md->js_fn_table[fn_index]) {

    }
    napi_value fn;
    return napi_get_reference_value(env, md->js_fn_table[fn_index], &fn) == napi_ok
        && napi_call_function(env, ctx->js_env, fn, argc, argv, dest) == napi_ok;
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
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(ctx, readSlot, 2, args, dest)) {
        return OK;
    }
    return Failure;
}

result write_slot(call* ctx,
                  napi_value object,
                  size_t slot,
                  napi_value value) {
    napi_env env = ctx->env;
    napi_value args[3] = { object, NULL, value };
    napi_value result;
    if ((args[0] || napi_get_null(env, &args[0]) == napi_ok)
     && napi_create_uint32(env, slot, &args[1]) == napi_ok
     && call_js_function(ctx, writeSlot, 3, args, &result)) {
        return OK;
    }
    return Failure;
}

result begin_structure(call* ctx,
                       const structure* s,
                       napi_value* dest) {
    napi_env env = ctx->env;
    napi_value args[2];
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
     && (!s->name || napi_create_string_utf8(env, s->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!s->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
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
     && napi_create_uint32(env, m->type, &type) == napi_ok
     && napi_set_named_property(env, args[1], "type", type) == napi_ok
     && napi_get_boolean(env, m->is_required, &is_required) == napi_ok
     && napi_set_named_property(env, args[1], "isRequired", is_required) == napi_ok
     && (m->bit_size == missing || napi_create_uint32(env, m->bit_size, &bit_size) == napi_ok)
     && (m->bit_size == missing || napi_set_named_property(env, args[1], "bitSize", bit_size) == napi_ok)
     && (m->bit_offset == missing || napi_create_uint32(env, m->bit_offset, &bit_offset) == napi_ok)
     && (m->bit_offset == missing || napi_set_named_property(env, args[1], "bitOffset", bit_offset) == napi_ok)
     && (m->byte_size == missing || napi_create_uint32(env, m->byte_size, &byte_size) == napi_ok)
     && (m->byte_size == missing || napi_set_named_property(env, args[1], "byteSize", byte_size) == napi_ok)
     && (m->slot == missing || napi_create_uint32(env, m->slot, &slot) == napi_ok)
     && (m->slot == missing || napi_set_named_property(env, args[1], "slot", slot) == napi_ok)
     && (!m->name || napi_create_string_utf8(env, m->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!m->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
     && (!m->structure || napi_set_named_property(env, args[1], "structure", m->structure) == napi_ok)
     && call_js_function(ctx, attachMember, 3, args, &result)) {
        return OK;
     }
     return Failure;
}

bool create_thunk(napi_env env,
                  thunk zig_fn,
                  napi_value* dest) {

}

result attach_method(call* ctx,
                     napi_value structure,
                     const method* m,
                     bool is_static_only) {
    napi_env env = ctx->env;
    napi_value args[3] = { structure };
    napi_value result;
    napi_value name, fn;
    if (napi_create_object(env, &args[1]) == napi_ok
     && napi_set_named_property(env, args[1], "argStruct", m->structure) == napi_ok
     && create_thunk(env, m->thunk, &fn)
     && napi_set_named_property(env, args[1], "thunk", fn) == napi_ok
     && (!m->name || napi_create_string_utf8(env, m->name, NAPI_AUTO_LENGTH, &name) == napi_ok)
     && (!m->name || napi_set_named_property(env, args[1], "name", name) == napi_ok)
     && napi_get_boolean(env, is_static_only, &args[2]) == napi_ok
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
     && call_js_function(ctx, attachTemplate, 1, args, &result)) {
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

napi_value load_module(napi_env env, napi_callback_info info) {
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
    return NULL;
}

napi_value get_gc_statistics(napi_env env, napi_callback_info info) {
    return NULL;
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

NAPI_MODULE_INIT() {
    return create_addon(env);
}