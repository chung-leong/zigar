#include <node.h>
#include <dlfcn.h>

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
  Float,
  Enum,
  Object,
  Type,
};

struct Structure {
  const char* name;
  StructureType type;
  size_t total_size;
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

struct Memory {
  uint8_t* bytes;
  size_t len;
};

enum class MemoryDisposition : uint32_t {
  Auto,
  Copy,
  Link,
};

struct MemoryAttributes {
  unsigned ptr_align: 8;
  bool is_const: 1;
  int :23;
};

struct Call;
typedef const char* (*Thunk)(Call*, Local<Value>);

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

union ModuleAttributes {
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
  Result (*get_memory)(Call*, Local<Object>, MemoryAttributes, Memory*);
  Result (*wrap_memory)(Call*, Local<Object>, const Memory&, MemoryDisposition, Local<Object>*);

  Result (*get_pointer_status)(Call*, Local<Object>, bool*);
  Result (*set_pointer_status)(Call*, Local<Object>, bool);

  Result (*read_global_slot)(Call*, size_t, Local<Value>*);
  Result (*write_global_slot)(Call*, size_t, Local<Value>);
  Result (*read_object_slot)(Call*, Local<Object>, size_t, Local<Value>*);
  Result (*write_object_slot)(Call*, Local<Object>, size_t, Local<Value>);

  Result (*begin_structure)(Call*, const Structure&, Local<Object>*);
  Result (*attach_member)(Call*, Local<Object>, const Member&, bool);
  Result (*attach_method)(Call*, Local<Object>, const Method&, bool);
  Result (*attach_template)(Call*, Local<Object>, Local<Object>, bool);
  Result (*finalize_structure)(Call*, Local<Object>);
  Result (*create_template)(Call*, const Memory&, Local<Object>*);

  Result (*write_to_console)(Call*, const Memory&);
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
  Global<Object> js_module;
  Global<Object> js_options;
  Global<External> addon_data;

  ModuleData(Isolate* isolate,
             void* so_handle,
             Local<Object> js_options,
             Local<External> addon_data) :
    ExternalData(isolate),
    so_handle(so_handle),
    js_options(isolate, js_options),
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

struct JSBridge;

struct Call {
  Isolate* isolate;
  Local<Context> context;
  Local<Array> mem_pool;
  Local<Map> shadow_map;
  Local<Array> arg_buffers;
  Local<Object> js_module;
  Local<Object> argument;
  Local<Object> global_slots;
  Local<Symbol> symbol_slots;
  Local<Symbol> symbol_memory;
  Local<Symbol> symbol_zig;
  FunctionData* function_data;
  bool remove_function_data;

  Call(Isolate* isolate,
       Local<External> module_data) :
    isolate(isolate),
    context(isolate->GetCurrentContext()),
    function_data(new FunctionData(isolate, nullptr, MethodAttributes{ .has_pointer = false }, module_data)),
    remove_function_data(true) {
  }

  Call(const FunctionCallbackInfo<Value> &info) :
    isolate(info.GetIsolate()),
    context(isolate->GetCurrentContext()),
    argument(info.This()),
    global_slots(info[0].As<Object>()),
    symbol_slots(info[1].As<Symbol>()),
    symbol_memory(info[2].As<Symbol>()),
    symbol_zig(info[3].As<Symbol>()),
    function_data(reinterpret_cast<FunctionData*>(info.Data().As<External>()->Value())),
    remove_function_data(false) {
  }

  ~Call() {
    if (remove_function_data) {
      delete function_data;
    }
  }
};

static Result GetArgumentBuffers(Call* call);

const size_t missing = SIZE_MAX;