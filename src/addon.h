#include <node.h>
#include <dlfcn.h>

using namespace v8;

//-----------------------------------------------------------------------------
//  Enum and structs used by both Zig and C++ code
//  (need to keep these in sync with their Zig definitions)
//-----------------------------------------------------------------------------
enum class Result : int {
  OK = 0,
  Failure = 1,
};

enum class StructureType : uint32_t {
  Normal = 0,
  Union,
  Enumeration,
  Singleton,
  Array,
  Opaque,
};

enum class MemberType : uint32_t {
  Void = 0,
  Bool,
  Int,
  Float,
  Structure,
  Pointer,
};

struct Member {
  const char* name;
  MemberType type;
  uint32_t bit_offset;
  uint32_t bits;
  bool is_signed;
  uint32_t len;
};

struct Host;
typedef void (*Thunk)(Host*);
typedef Result (*Factory)(Host*, Local<Value>*);
struct Callbacks;
struct Module {
  int version;
  Callbacks* callbacks;
  Factory factory;
};

//-----------------------------------------------------------------------------
//  Function-pointer table used by Zig code
//-----------------------------------------------------------------------------
struct Callbacks {
  Result (*allocate_memory)(Host*, size_t, uint8_t **dest);
  Result (*reallocate_memory)(Host*, size_t, uint8_t **dest);
  Result (*free_memory)(Host*, uint8_t **dest);

  Result (*get_slot)(Host*, size_t, Local<Value>*);
  Result (*set_slot)(Host*, size_t, Local<Value>);

  Result (*begin_structure)(Host*, StructureType, Local<Object>*);
  Result (*add_member)(Host*, Local<Object>, Member);
  Result (*finalize_structure)(Host*, Local<Object>, Local<Object>*);
};

//-----------------------------------------------------------------------------
//  Per isolate data structures 
//-----------------------------------------------------------------------------
struct AddonData {
  Global<External> external;

  AddonData(Isolate* isolate) {
    external.Reset(isolate, External::New(isolate, this));
    external.template SetWeak<AddonData>(this, 
      [](const v8::WeakCallbackInfo<AddonData>& data) {
        AddonData* self = data.GetParameter();
        self->external.Reset();
        delete self;
      }, WeakCallbackType::kParameter);
  }

  virtual ~AddonData() = 0;
};


struct ModuleData : public AddonData {
  static int count;
  void *so_handle;  

  ModuleData(Isolate* isolate, void* so_handle) : 
    AddonData(isolate), 
    so_handle(so_handle) {
    count++;
  }

  ~ModuleData() {
    dlclose(so_handle);
    count--;
  }
};

struct FunctionData : public AddonData {  
  Thunk thunk;
  Global<Object> slot_data;

  FunctionData(Isolate* isolate, Thunk thunk, Local<Object> data) :
    AddonData(isolate),
    thunk(thunk) {
    slot_data.Reset(isolate, data);
  }
};

//-----------------------------------------------------------------------------
//  Structure used passed stuff to Zig code and back (per call)
//-----------------------------------------------------------------------------
struct Host {
  Isolate* isolate;  
  const FunctionCallbackInfo<Value>* v8_args;
  Local<Context> exec_context;
  Local<Array> mem_pool;
  FunctionData* zig_func;

  Host(const FunctionCallbackInfo<Value> &info) {
    v8_args = &info;
    isolate = info.GetIsolate();
    exec_context = isolate->GetCurrentContext();
    if (info.Data()->IsExternal()) {
      zig_func = reinterpret_cast<FunctionData*>(info.Data().As<External>()->Value());
    } else {
      zig_func = nullptr;
    }
  }
};

