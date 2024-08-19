#ifndef _ADDON_H_
#define _ADDON_H_
#include <node_api.h>
#ifdef __GNUC__
    #define __USE_GNU
    #ifdef __i386__
        #define __cdecl __attribute__((__cdecl__))
    #else
        #define __cdecl
    #endif
#endif
#include "redirect.h"
#ifdef WIN32
    #include "win32-shim.h"
#else
    #include <dlfcn.h>
#endif
#include <stdlib.h>
#include <string.h>

#define MISSING(T)                      ((T) -1)

#define EXPORT_COUNT    13
#define IMPORT_COUNT    14

#if UINTPTR_MAX == UINT64_MAX
    #define UINTPTR_JS_TYPE             "bigint"
#else
    #define UINTPTR_JS_TYPE             "number"
#endif

inline napi_status napi_create_uintptr(napi_env env,
                                       uintptr_t value,
                                       napi_value* result) {
#if UINTPTR_MAX == UINT64_MAX
    return napi_create_bigint_uint64(env, value, result);
#else
    return napi_create_uint32(env, value, result);
#endif
}

inline napi_status napi_get_value_uintptr(napi_env env,
                                          napi_value value,
                                          uintptr_t* result) {
#if UINTPTR_MAX == UINT64_MAX
    bool lossless;
    return napi_get_value_bigint_uint64(env, value, (uint64_t*) result, &lossless);
#else
    return napi_get_value_uint32(env, value, (uint32_t*) result);
#endif
}

napi_value create_addon(napi_env env);

typedef uint32_t result;
enum {
    OK,
    FAILURE,
    DEADLOCK,
};

typedef uint32_t structure_type;
typedef uint32_t member_type;

typedef struct {
    const char* name;
    structure_type type;
    size_t length;
    size_t byte_size;
    uint16_t align;
    bool is_const;
    bool is_tuple;
    bool is_iterator;
    bool has_pointer;
} structure;

typedef struct {
    const char* name;
    member_type type;
    bool is_required;
    bool is_signed;
    size_t bit_offset;
    size_t bit_size;
    size_t byte_size;
    size_t slot;
    napi_value structure;
} member;

typedef struct  {
    // need to structure the fields in this manner for the sake of VC++
    union {
        struct {
            uint16_t align: 16;
            bool is_const: 1;
            bool is_comptime: 1;
        };
        uint32_t _;
    };
} memory_attributes;

typedef struct {
    uint8_t* bytes;
    size_t len;
    memory_attributes attributes;
} memory;

typedef struct export_table export_table;
typedef struct import_table import_table;

typedef struct {
    union {
        struct {
            bool little_endian: 1;
            bool runtime_safety: 1;
        };
        uint32_t _;
    };
} module_attributes;

typedef struct {
    uint32_t version;
    module_attributes attributes;
    export_table* exports;
    import_table* imports;
} module;

typedef struct {
    int ref_count;
    module *mod;
    void* so_handle;
    uintptr_t base_address;
    napi_env env;
    napi_ref js_env;
    napi_ref js_fns[IMPORT_COUNT];
    napi_threadsafe_function ts_fn;
} module_data;

typedef struct {
    napi_ref env_constructor;
} addon_data;


typedef struct {
    size_t id;
    void* arg_ptr;
    size_t arg_size;
} js_call;

typedef struct {
    size_t id;
    void* arg_ptr;
    size_t arg_size;
    size_t futex_handle;
} deferred_js_call;

typedef struct export_table {
    result (__cdecl *allocate_host_memory)(module_data*, size_t, uint16_t, memory*);
    result (__cdecl *free_host_memory)(module_data*, const memory*);
    result (__cdecl *capture_string)(module_data*, const memory*, napi_value*);
    result (__cdecl *capture_view)(module_data*, const memory*, napi_value*);
    result (__cdecl *cast_view)(module_data*, const memory*, napi_value, napi_value*);
    result (__cdecl *read_slot)(module_data*, napi_value, size_t, napi_value*);
    result (__cdecl *write_slot)(module_data*, napi_value, size_t, napi_value);
    result (__cdecl *begin_structure)(module_data*, const structure*, napi_value*);
    result (__cdecl *attach_member)(module_data*, napi_value, const member*, bool);
    result (__cdecl *attach_template)(module_data*, napi_value, napi_value, bool);
    result (__cdecl *finalize_shape)(module_data*, napi_value);
    result (__cdecl *end_structure)(module_data*, napi_value);
    result (__cdecl *create_template)(module_data*, napi_value, napi_value*);
    result (__cdecl *write_to_console)(module_data*, napi_value);
} export_table;

typedef struct import_table {
    result (__cdecl *initialize)(module_data*);
    result (__cdecl *allocate_extern_memory)(uint32_t, size_t, uint16_t, memory*);
    result (__cdecl *free_extern_memory)(uint32_t, const memory*);
    result (__cdecl *get_factory_thunk)(size_t*);
    result (__cdecl *run_thunk)(module_data*, size_t, size_t, void*, napi_value*);
    result (__cdecl *run_variadic_thunk)(module_data*, size_t, size_t, void*, void*, size_t, napi_value*);
    result (__cdecl *override_write)(const void*, size_t);
    result (__cdecl *wake_caller)(size_t, uint32_t);
} import_table;

#endif