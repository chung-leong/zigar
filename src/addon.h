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
  Opaque,
};

enum class MemberType : uint32_t {
  Void = 0,
  Bool,
  Int,
  Float,
  Enum,
  Compound,
  Pointer,
  Type,
};

struct Memory {
  uint8_t* bytes;
  size_t len;
};

struct Member {
  const char* name;
  MemberType type;
  bool is_required;
  bool is_signed;
  uint32_t bit_offset;
  uint32_t bit_size;
  uint32_t byte_size;
  uint32_t slot;
  Local<Value> structure;
};

struct MemberSet {
  const Member* members;
  size_t member_count;
  size_t total_size;
  Memory default_data;
  const Memory* default_pointers;
  size_t default_pointer_count;
};

struct Host;
typedef void (*Thunk)(Host*, Local<Value>);

struct Method {
  const char* name;  
  bool is_static_only;
  Thunk thunk;
  Local<Value> structure;
};

struct MethodSet {
  const Method* methods;
  uint32_t method_count;
};

union ModuleFlags {
  struct {
    bool little_endian: 1;
    bool runtime_safety: 1;
  };
  uint32_t flags;
};

struct Callbacks;
typedef Result (*Factory)(Host*, Local<Value>*);

struct Module {
  uint32_t version;
  ModuleFlags flags;
  Callbacks* callbacks;
  Factory factory;
};

struct Callbacks {
  Result (*allocate_memory)(Host*, size_t, Memory*);
  Result (*reallocate_memory)(Host*, size_t, Memory*);
  Result (*free_memory)(Host*, Memory*);
  Result (*get_memory)(Host*, Local<Object>, Memory*);
  Result (*get_relocatable)(Host*, Local<Object>, uint32_t, Memory*);

  Result (*read_slot)(Host*, uint32_t, Local<Value>*);
  Result (*write_slot)(Host*, uint32_t, Local<Value>);

  Result (*create_structure)(Host*, StructureType, const char*, Local<Object>*);
  Result (*shape_structure)(Host*, Local<Object>, const MemberSet&);
  Result (*attach_variables)(Host*, Local<Object>, const MemberSet&);
  Result (*attach_methods)(Host*, Local<Object>, const MethodSet&);
};

struct ExternalData {
  Global<External> external;

  ExternalData(Isolate* isolate) :
    external(isolate, External::New(isolate, this)) {
    external.template SetWeak<ExternalData>(this, 
      [](const v8::WeakCallbackInfo<ExternalData>& data) {
        auto self = data.GetParameter();
        self->external.Reset();
        delete self;
      }, WeakCallbackType::kParameter);
  }

  virtual ~ExternalData() = 0;
};

struct AddonData : public ExternalData {
  Global<Object> js_module;

  AddonData(Isolate* isolate) :
    ExternalData(isolate) {}

  ~AddonData() {}
};

struct ModuleData : public ExternalData {
  static int count;
  void* so_handle;

  ModuleData(Isolate* isolate, 
             void* so_handle) : 
    ExternalData(isolate), 
    so_handle(so_handle) {
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
  Global<Object> slots;
  Global<External> module_data;

  FunctionData(Isolate* isolate, 
               Thunk thunk, 
               Local<External> module_data) :
    ExternalData(isolate),
    thunk(thunk),
    slots(isolate, Object::New(isolate)),
    module_data(isolate, module_data) {
    count++;
  }

  ~FunctionData() {
    count--;
  }
};

static void Call(const FunctionCallbackInfo<Value>& info);

struct JSBridge {
  Isolate* isolate;
  Local<Context> context;
  Local<External> module_data;

  Local<Function> create_structure;
  Local<Function> shape_structure;
  Local<Function> attach_variables;
  Local<Function> attach_methods;

  Local<String> t_type;
  Local<String> t_signed;
  Local<String> t_bit_offset;
  Local<String> t_bit_size;
  Local<String> t_byte_size;
  Local<String> t_name;
  Local<String> t_size;
  Local<String> t_members;
  Local<String> t_methods;
  Local<String> t_structure;
  Local<String> t_default_data;
  Local<String> t_default_pointers;
  Local<String> t_expose_data_view;
  Local<String> t_arg_struct;
  Local<String> t_thunk;
  Local<String> t_static_only;

  Local<Object> options;

  JSBridge(Isolate* isolate,
           Local<Object> module,
           Local<External> module_data,
           ModuleFlags flags) :
    isolate(isolate),
    context(isolate->GetCurrentContext()),
    module_data(module_data),
    t_type(String::NewFromUtf8Literal(isolate, "type")),
    t_signed(String::NewFromUtf8Literal(isolate, "signed")),
    t_bit_offset(String::NewFromUtf8Literal(isolate, "bitOffset")),
    t_bit_size(String::NewFromUtf8Literal(isolate, "bitSize")),
    t_byte_size(String::NewFromUtf8Literal(isolate, "byteSize")),
    t_name(String::NewFromUtf8Literal(isolate, "name")),
    t_size(String::NewFromUtf8Literal(isolate, "size")),
    t_members(String::NewFromUtf8Literal(isolate, "members")),
    t_methods(String::NewFromUtf8Literal(isolate, "methods")),
    t_structure(String::NewFromUtf8Literal(isolate, "structure")),
    t_default_data(String::NewFromUtf8Literal(isolate, "defaultData")),
    t_default_pointers(String::NewFromUtf8Literal(isolate, "defaultPointers")),
    t_expose_data_view(String::NewFromUtf8Literal(isolate, "exposeDataView")),
    t_arg_struct(String::NewFromUtf8Literal(isolate, "argStruct")),
    t_thunk(String::NewFromUtf8Literal(isolate, "thunk")),
    t_static_only(String::NewFromUtf8Literal(isolate, "staticOnly")),
    options(Object::New(isolate)) {
    // set options
    auto little_endian = Boolean::New(isolate, flags.little_endian);
    auto runtime_safety = Boolean::New(isolate, flags.runtime_safety);
    options->Set(context, String::NewFromUtf8Literal(isolate, "littleEndian"), little_endian).Check();
    options->Set(context, String::NewFromUtf8Literal(isolate, "realTimeSafety"), runtime_safety).Check();
    // look up functions
    auto find = [&](Local<String> name, Local<Function>* dest) {
      Local<Value> value;
      if (module->Get(context, name).ToLocal<Value>(&value)) {
        if (value->IsFunction()) {
          *dest = value.As<Function>();
        }
      }
    };
    find(String::NewFromUtf8Literal(isolate, "createStructure"), &create_structure);
    find(String::NewFromUtf8Literal(isolate, "shapeStructure"), &shape_structure);
    find(String::NewFromUtf8Literal(isolate, "attachVariables"), &attach_variables);
    find(String::NewFromUtf8Literal(isolate, "attachMethods"), &attach_methods);
  };

  Local<Object> NewMemberRecord(const Member& m) {
    auto member = Object::New(isolate);
    printf("Member: %s (%u)\n", m.name, m.bit_size);
    if (m.name) {
      member->Set(context, t_name, String::NewFromUtf8(isolate, m.name).ToLocalChecked()).Check();
    }
    member->Set(context, t_type, Int32::New(isolate, static_cast<int32_t>(m.type))).Check();
    member->Set(context, t_bit_size, Int32::New(isolate, m.bit_size)).Check();
    member->Set(context, t_bit_offset, Int32::New(isolate, m.bit_offset)).Check();
    member->Set(context, t_byte_size, Int32::New(isolate, m.byte_size)).Check();
    if (m.type == MemberType::Int) {      
      member->Set(context, t_signed, Boolean::New(isolate, m.is_signed)).Check();
    }
    return member;
  }

  Local<Object> NewMethodRecord(const Method &m) {
    auto fd = new FunctionData(isolate, m.thunk, module_data);
    auto fde = Local<External>::New(isolate, fd->external);
    auto tmpl = FunctionTemplate::New(isolate, Call, fde, Local<Signature>(), 1);
    Local<Object> def = Object::New(isolate);
    def->Set(context, t_name, String::NewFromUtf8(isolate, m.name).ToLocalChecked()).Check();
    def->Set(context, t_arg_struct, m.structure).Check();
    Local<Function> function;
    if (tmpl->GetFunction(context).ToLocal(&function)) {
      def->Set(context, t_thunk, function).Check();
    }
    def->Set(context, t_static_only, Boolean::New(isolate, m.is_static_only)).Check();
    return def;   
  }

  Local<Object> NewMemberSet(size_t size,
                             Local<Array> members,
                             Local<Object> defaultData, 
                             Local<Object> defaultPointers) {
    auto def = Object::New(isolate);
    if (size > 0) {
      def->Set(context, t_size, Uint32::NewFromUnsigned(isolate, static_cast<uint32_t>(size))).Check();
    }
    def->Set(context, t_members, members).Check();
    if (!defaultData.IsEmpty()) {
      def->Set(context, t_default_data, defaultData).Check();
    }
    if (!defaultPointers.IsEmpty()) {
      def->Set(context, t_default_pointers, defaultPointers).Check();
    }
    return def;
  }

  Local<Object> NewMethodSet(Local<Array> methods) {
    auto def = Object::New(isolate);
    def->Set(context, t_methods, methods).Check();
    return def;
  }
};

struct Host {
  Isolate* isolate;  
  Local<Context> exec_context;
  Local<Array> mem_pool;
  Local<Object> slots;
  FunctionData* zig_func;
  JSBridge* js_bridge;

  Host(const FunctionCallbackInfo<Value> &info) :
    js_bridge(nullptr) {
    isolate = info.GetIsolate();
    exec_context = isolate->GetCurrentContext();
    if (info.Data()->IsExternal()) {
      zig_func = reinterpret_cast<FunctionData*>(info.Data().As<External>()->Value());
    } else {
      zig_func = nullptr;
    }
  }
};
