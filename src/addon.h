#include <node.h>
#include <dlfcn.h>

using namespace v8;

enum class Result : int {
  OK = 0,
  Failure = 1,
};

enum class StructureType : uint32_t {
  Primitive = 0,
  Array,
  Struct,
  ExternUnion,
  TaggedUnion,
  ErrorUnion,
  Enumeration,
  Optional,
  Pointer,
  Slice,
  Opaque,
  ArgStruct,
};

enum class MemberType : uint32_t {
  Void = 0,
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
};

struct Member {
  const char* name;
  MemberType type;
  bool is_static;
  bool is_required;
  bool is_signed;
  bool is_const;
  uint32_t bit_offset;
  uint32_t bit_size;
  uint32_t byte_size;
  uint32_t slot;
  Local<Value> structure;
};

struct Memory {
  uint8_t* bytes;
  size_t len;
};

struct Template {
  bool is_static;
  Local<Value> object;
};

struct Host;
typedef void (*Thunk)(Host*, Local<Value>);

struct Method {
  const char* name;
  bool is_static_only;
  Thunk thunk;
  Local<Value> structure;
};

union ModuleFlags {
  struct {
    bool little_endian: 1;
    bool runtime_safety: 1;
  };
  uint32_t flags;
};

struct Callbacks;

struct Module {
  uint32_t version;
  ModuleFlags flags;
  Callbacks* callbacks;
  Thunk factory;
};

struct Callbacks {
  Result (*allocate_memory)(Host*, size_t, Memory*);
  Result (*reallocate_memory)(Host*, size_t, Memory*);
  Result (*free_memory)(Host*, Memory*);
  Result (*get_memory)(Host*, Local<Object>, Memory*);
  Result (*wrap_memory)(Host*, Local<Object>, const Memory&, Local<Object>*);

  Result (*get_pointer_status)(Host*, Local<Object>, bool*);
  Result (*set_pointer_status)(Host*, Local<Object>, bool);

  Result (*read_global_slot)(Host*, uint32_t, Local<Value>*);
  Result (*write_global_slot)(Host*, uint32_t, Local<Value>);
  Result (*read_object_slot)(Host*, Local<Object>, uint32_t, Local<Object>*);
  Result (*write_object_slot)(Host*, Local<Object>, uint32_t, Local<Object>);

  Result (*begin_structure)(Host*, const Structure&, Local<Object>*);
  Result (*attach_member)(Host*, Local<Object>, const Member&);
  Result (*attach_method)(Host*, Local<Object>, const Method&);
  Result (*attach_template)(Host*, Local<Object>, const ::Template&);
  Result (*finalize_structure)(Host*, Local<Object>);
  Result (*create_template)(Host*, const Memory&, Local<Object>*);
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
  Global<External> module_data;

  FunctionData(Isolate* isolate,
               Thunk thunk,
               Local<External> module_data) :
    ExternalData(isolate),
    thunk(thunk),
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

struct Host {
  Isolate* isolate;
  Local<Context> context;
  Local<Array> mem_pool;
  Local<Array> arg_buffers;
  Local<Object> js_module;
  Local<Object> argument;
  Local<Object> global_slots;
  Local<Symbol> symbol_slots;
  Local<Symbol> symbol_memory;
  Local<Symbol> symbol_zig;
  FunctionData* function_data;
  bool remove_function_data;

  Host(Isolate* isolate,
       Local<External> module_data) :
    isolate(isolate),
    context(isolate->GetCurrentContext()),
    function_data(new FunctionData(isolate, nullptr, module_data)),
    remove_function_data(true) {
  }

  Host(const FunctionCallbackInfo<Value> &info) :
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

  ~Host() {
    if (remove_function_data) {
      delete function_data;
    }
  }
};

static Result GetArgumentBuffers(Host* call);
static Result Log(Host* call,
                  int argc,
                  Local<Value>* argv) __attribute__((unused));
