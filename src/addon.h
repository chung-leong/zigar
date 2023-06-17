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

struct DefaultValues {
  bool is_static;
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

  Result (*begin_structure)(Host*, const Structure&, Local<Object>*);
  Result (*attach_member)(Host*, Local<Object>, const Member&);
  Result (*attach_method)(Host*, Local<Object>, const Method&);
  Result (*attach_default_values)(Host*, Local<Object>, const DefaultValues&);
  Result (*finalize_structure)(Host*, Local<Object>);
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

  virtual ~ExternalData() {};
};

struct AddonData : public ExternalData {
  Global<Object> js_module;

  AddonData(Isolate* isolate) :
    ExternalData(isolate) {}

  ~AddonData() {
    printf("~AddonData\n");
  }
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
    printf("~ModuleData\n");
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
    printf("~FunctionData\n");
    count--;
  }
};

static void Call(const FunctionCallbackInfo<Value>& info);

struct JSBridge {
  Isolate* isolate;
  Local<Context> context;
  Local<External> module_data;

  Local<Function> begin_structure;
  Local<Function> attach_member;
  Local<Function> attach_method;
  Local<Function> attach_default_values;
  Local<Function> finalize_structure;

  Local<String> t_type;
  Local<String> t_is_static;
  Local<String> t_is_signed;
  Local<String> t_is_required;
  Local<String> t_is_const;
  Local<String> t_bit_offset;
  Local<String> t_bit_size;
  Local<String> t_byte_size;
  Local<String> t_slot;
  Local<String> t_name;
  Local<String> t_size;
  Local<String> t_structure;
  Local<String> t_data;
  Local<String> t_pointers;
  Local<String> t_expose_data_view;
  Local<String> t_arg_struct;
  Local<String> t_thunk;
  Local<String> t_is_static_only;

  Local<Object> options;

  JSBridge(Isolate* isolate,
           Local<Object> module,
           Local<External> module_data,
           ModuleFlags flags) :
    isolate(isolate),
    context(isolate->GetCurrentContext()),
    module_data(module_data),
    t_type(String::NewFromUtf8Literal(isolate, "type")),
    t_is_static(String::NewFromUtf8Literal(isolate, "isStatic")),
    t_is_signed(String::NewFromUtf8Literal(isolate, "isSigned")),
    t_is_required(String::NewFromUtf8Literal(isolate, "isRequired")),
    t_is_const(String::NewFromUtf8Literal(isolate, "isConst")),
    t_bit_offset(String::NewFromUtf8Literal(isolate, "bitOffset")),
    t_bit_size(String::NewFromUtf8Literal(isolate, "bitSize")),
    t_byte_size(String::NewFromUtf8Literal(isolate, "byteSize")),
    t_slot(String::NewFromUtf8Literal(isolate, "slot")),
    t_name(String::NewFromUtf8Literal(isolate, "name")),
    t_size(String::NewFromUtf8Literal(isolate, "size")),
    t_structure(String::NewFromUtf8Literal(isolate, "structure")),
    t_data(String::NewFromUtf8Literal(isolate, "data")),
    t_pointers(String::NewFromUtf8Literal(isolate, "pointers")),
    t_expose_data_view(String::NewFromUtf8Literal(isolate, "exposeDataView")),
    t_arg_struct(String::NewFromUtf8Literal(isolate, "argStruct")),
    t_thunk(String::NewFromUtf8Literal(isolate, "thunk")),
    t_is_static_only(String::NewFromUtf8Literal(isolate, "isStaticOnly")),
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
    find(String::NewFromUtf8Literal(isolate, "beginStructure"), &begin_structure);
    find(String::NewFromUtf8Literal(isolate, "attachMember"), &attach_member);
    find(String::NewFromUtf8Literal(isolate, "attachMethod"), &attach_method);
    find(String::NewFromUtf8Literal(isolate, "attachDefaultValues"), &attach_default_values);
    find(String::NewFromUtf8Literal(isolate, "finalizeStructure"), &finalize_structure);
  };

  Local<Object> NewStructure(const Structure& s) {
    auto def = Object::New(isolate);
    def->Set(context, t_type, Int32::New(isolate, static_cast<int32_t>(s.type))).Check();
    if (s.name) {
      def->Set(context, t_name, String::NewFromUtf8(isolate, s.name).ToLocalChecked()).Check();
    }
    def->Set(context, t_size, Uint32::NewFromUnsigned(isolate, s.total_size)).Check();
    return def;
  }

  Local<Object> NewMember(const Member& m) {
    auto def = Object::New(isolate);
    if (m.name) {
      def->Set(context, t_name, String::NewFromUtf8(isolate, m.name).ToLocalChecked()).Check();
    }
    def->Set(context, t_type, Int32::New(isolate, static_cast<int32_t>(m.type))).Check();
    def->Set(context, t_is_static, Boolean::New(isolate, m.is_static)).Check();
    def->Set(context, t_is_required, Boolean::New(isolate, m.is_required)).Check();
    if (m.type == MemberType::Int) {      
      def->Set(context, t_is_signed, Boolean::New(isolate, m.is_signed)).Check();
    } else if (m.type == MemberType::Pointer) {
      def->Set(context, t_is_const, Boolean::New(isolate, m.is_const)).Check();
    }
    def->Set(context, t_bit_size, Uint32::NewFromUnsigned(isolate, m.bit_size)).Check();
    def->Set(context, t_bit_offset, Uint32::NewFromUnsigned(isolate, m.bit_offset)).Check();
    def->Set(context, t_byte_size, Uint32::NewFromUnsigned(isolate, m.byte_size)).Check();
    if (!m.structure.IsEmpty()) {
      def->Set(context, t_structure, m.structure).Check();
      def->Set(context, t_slot, Uint32::NewFromUnsigned(isolate, m.slot)).Check();
    }
    return def;
  }

  Local<Object> NewMethod(const Method &m) {
    auto fd = new FunctionData(isolate, m.thunk, module_data);
    auto fde = Local<External>::New(isolate, fd->external);
    auto tmpl = FunctionTemplate::New(isolate, Call, fde, Local<Signature>(), 1);
    auto def = Object::New(isolate);
    def->Set(context, t_name, String::NewFromUtf8(isolate, m.name).ToLocalChecked()).Check();
    def->Set(context, t_arg_struct, m.structure).Check();
    Local<Function> function;
    if (tmpl->GetFunction(context).ToLocal(&function)) {
      def->Set(context, t_thunk, function).Check();
    }
    def->Set(context, t_is_static_only, Boolean::New(isolate, m.is_static_only)).Check();
    return def;   
  }

  Local<Object> NewDefaultValues(bool is_static,
                                 Local<Value> data,
                                 Local<Value> pointers) {
    auto def = Object::New(isolate);
    def->Set(context, t_is_static, Boolean::New(isolate, is_static)).Check();
    if (!data.IsEmpty()) {
      def->Set(context, t_data, data).Check();
    }
    if (!pointers.IsEmpty()) {
      def->Set(context, t_pointers, pointers).Check();
    }
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
