#ifndef _ADDON_H_
#define _ADDON_H_
#include <js_native_api.h>
#ifdef WIN32
  #include "win32-shim.h"
#else
  #include <dlfcn.h>
#endif
#include <stdlib.h>
#include <string.h>

#define MISSING   SIZE_MAX

napi_value create_addon(napi_env env);

typedef uint32_t result;
enum {
  OK,
  Failure,
};

typedef uint32_t structure_type;
enum {
  Primitive,
  Array,
  Struct,
  ArgStruct,
  ExternUnion,
  BareUnion,
  TaggedUnion,
  ErrorUnion,
  ErrorSet,
  Enumeration,
  Optional,
  Pointer,
  Slice,
  Vector,
  Opaque,
  Function,
};

typedef uint32_t member_type;
enum {
  Void,
  Bool,
  Int,
  Uint,
  Float,
  Enum,
  Object,
  Type,
  Comptime,
  Static,
  Literal,
};

typedef struct {
  const char* name;
  structure_type type;
  size_t length;
  size_t byte_size;
  uint16_t align;
  bool is_const;
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

typedef struct call call;
typedef napi_value (__cdecl *thunk)(call*, void*);

typedef struct {
  union {
    struct {
      bool has_pointer: 1;
    };
    uint32_t _;
  };
} method_attributes;

typedef struct {
  const char* name;
  thunk thunk;
  napi_value structure;
  method_attributes attributes;
} method;

typedef struct {
  result (*allocate_relocatable_memory)(call*, size_t, uint16_t, memory*);
  result (*free_relocatable_memory)(call*, const memory*);
  result (*create_string)(call*, const memory*, napi_value*);
  result (*create_object)(call*, napi_value, napi_value, napi_value*);
  result (*create_view)(call*, const memory*, napi_value*);
  result (*cast_view)(call*, napi_value, napi_value, napi_value*);
  result (*read_slot)(call*, napi_value, size_t, napi_value*);
  result (*write_slot)(call*, napi_value, size_t, napi_value);
  result (*begin_structure)(call*, const structure*, napi_value*);
  result (*attach_member)(call*, napi_value, const member*, bool);
  result (*attach_method)(call*, napi_value, const method*, bool);
  result (*attach_template)(call*, napi_value, napi_value, bool);
  result (*finalize_structure)(call*, napi_value);
  result (*create_template)(call*, napi_value, napi_value*);
  result (*write_to_console)(call*, napi_value);
  result (*flush_console)(call*);
} export_table;

typedef enum {
  allocateRelocatableMemory,
  freeRelocatableMemory,
  createString,
  createObject,
  createView,
  castView,
  readSlot,
  writeSlot,
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
  createTemplate,
  writeToConsole,
  flushConsole,
  invokeFactory,

  env_method_count,
} js_function;

typedef struct {
  result (*allocate_fixed_memory)(size_t, uint16_t, memory*);
  result (*free_fixed_memory)(const memory*);
} import_table;

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
  thunk factory;
} module;

typedef struct module_data module_data;
typedef struct function_data function_data;

struct module_data {
  int ref_count;
  void* so_handle;
  const import_table* imports;
  module_attributes attributes;
  napi_ref options;
  napi_ref js_fn_refs[env_method_count];
};

struct function_data {
  thunk zig_fn;
  method_attributes attributes;
  module_data* mod_data;
};

struct call {
  napi_env env;
  napi_value js_env;
  napi_value options;
  function_data* fn_data;
};

#endif