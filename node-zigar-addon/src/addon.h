#include <node.h>
#ifdef WIN32
  #include "dlfcn.win32.h"
#else
  #include <dlfcn.h>
#endif

#if defined(__GNUC__) && __GNUC__ >= 8
#define DISABLE_WCAST_FUNCTION_TYPE _Pragma("GCC diagnostic push") _Pragma("GCC diagnostic ignored \"-Wcast-function-type\"")
#define DISABLE_WCAST_FUNCTION_TYPE_END _Pragma("GCC diagnostic pop")
#else
#define DISABLE_WCAST_FUNCTION_TYPE
#define DISABLE_WCAST_FUNCTION_TYPE_END
#endif

using namespace v8;

enum class Result : int {
  OK,
  Failure,
};

enum class StructureType : uint32_t {
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

enum class MemberType : uint32_t {
  Void,
  Bool,
  Int,
  Uint,
  Float,
  Enum,
  Object,
  Type,
  Comptime,
};

struct Structure {
  const char* name;
  StructureType type;
  size_t length;
  size_t byte_size;
  uint8_t ptr_align;
  bool is_const;
  bool has_pointer;
};

struct Member {
  const char* name;
  MemberType type;
  bool is_required;
  bool is_signed;
  size_t bit_offset;
  size_t bit_size;
  size_t byte_size;
  size_t slot;
  Local<Value> structure;
};

enum class MemoryDisposition : uint32_t {
  Auto,
  Copy,
  Link,
};

struct MemoryAttributes {
  unsigned ptr_align: 8;
  bool is_const: 1;
  bool is_comptime: 1;
  int :22;
};

struct Memory {
  uint8_t* bytes;
  size_t len;
  MemoryAttributes attributes;
};

struct Call;
typedef Local<Value> (*Thunk)(Call*, void*);

struct MethodAttributes {
  bool has_pointer: 1;
  int :31;
};

struct Method {
  const char* name;
  Thunk thunk;
  Local<Value> structure;
  MethodAttributes attributes;
};

struct ModuleAttributes {
  bool little_endian: 1;
  bool runtime_safety: 1;
  int :30;
};

struct Callbacks;

struct Module {
  uint32_t version;
  ModuleAttributes attributes;
  Callbacks* callbacks;
  Thunk factory;
};

struct Callbacks {
  Result (*allocate_memory)(Call*, size_t, uint8_t, Memory*);
  Result (*free_memory)(Call*, const Memory&, uint8_t);
  Result (*create_string)(Call*, const Memory&, Local<Value>*);
  Result (*create_object)(Call*, Local<Object>, Local<Value>, Local<Object>*);
  Result (*create_view)(Call*, const Memory&, Local<DataView>*);
  Result (*cast_view)(Call*, Local<Object>, Local<DataView>, Local<Object>*);
  Result (*read_slot)(Call*, Local<Object>, size_t, Local<Value>*);
  Result (*write_slot)(Call*, Local<Object>, size_t, Local<Value>);
  Result (*begin_structure)(Call*, const Structure&, Local<Object>*);
  Result (*attach_member)(Call*, Local<Object>, const Member&, bool);
  Result (*attach_method)(Call*, Local<Object>, const Method&, bool);
  Result (*attach_template)(Call*, Local<Object>, Local<Object>, bool);
  Result (*finalize_structure)(Call*, Local<Object>);
  Result (*create_template)(Call*, Local<DataView>, Local<Object>*);
  Result (*write_to_console)(Call*, Local<DataView>);
  Result (*flush_console)(Call*);
};

struct ExternalData {
  Global<External> external;

  ExternalData(Isolate* isolate) :
    external(isolate, External::New(isolate, this)) {
    external.template SetWeak<ExternalData>(this,
      [](const v8::WeakCallbackInfo<ExternalData>& data) {
        auto self = data.GetParameter();
        delete self;
      }, WeakCallbackType::kParameter);
  }

  virtual ~ExternalData() {};
};

struct AddonData : public ExternalData {
  static int script_count;
  Global<Script> js_script;

  AddonData(Isolate* isolate) :
    ExternalData(isolate) {}

  ~AddonData() {}
};

struct ModuleData : public ExternalData {
  static int count;
  void* so_handle;
  Global<Object> js_options;
  Global<Object> global_slots;
  Global<External> addon_data;

  ModuleData(Isolate* isolate,
             void* so_handle,
             Local<Object> js_options,
             Local<External> addon_data) :
    ExternalData(isolate),
    so_handle(so_handle),
    js_options(isolate, js_options),
    global_slots(isolate, Object::New(isolate)),
    addon_data(isolate, addon_data) {
    count++;
  }

  ~ModuleData() {
    dlclose(so_handle);
    count--;
  }
};

struct FunctionData : public ExternalData {
  static int count;
  Thunk thunk;
  MethodAttributes attributes;
  Global<External> module_data;

  FunctionData(Isolate* isolate,
               Thunk thunk,
               MethodAttributes attributes,
               Local<External> module_data) :
    ExternalData(isolate),
    thunk(thunk),
    attributes(attributes),
    module_data(isolate, module_data) {
    count++;
  }

  ~FunctionData() {
    count--;
  }
};

struct ExternalMemoryData {
  static int count;
  Global<External> module_data;

  ExternalMemoryData(Isolate* isolate,
                     Local<External> module_data) :
    module_data(isolate, module_data) {
    count++;
  }

  ~ExternalMemoryData() {
    count--;
  }
};

struct Call {
  Isolate* isolate;
  Local<Context> context;
  Local<Object> env;
  Local<Object> js_module;
  Local<Object> global_slots;
  FunctionData* function_data;

  Call(Isolate* isolate,
       Local<Object> env,
       Local<External> function_data) :
    isolate(isolate),
    context(isolate->GetCurrentContext()),
    env(env),
    function_data(reinterpret_cast<FunctionData*>(function_data->Value())) {}
};

const size_t missing = SIZE_MAX;