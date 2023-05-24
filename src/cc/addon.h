#include <node.h>
#include <dlfcn.h>

using namespace v8;

//-----------------------------------------------------------------------------
//  Enum and structs used by both Zig and C++ code
//  (need to keep these in sync with their Zig definitions)
//-----------------------------------------------------------------------------
enum class Result : int {
  ok = 0,
  failure = 1,
};
enum class NumberType : int {
  unknown,
  i8,
  u8,
  i16,
  u16,
  i32,
  u32,
  i64,
  u64,
  f32,
  f64,
};
union ValueMask {
  struct {
    bool empty: 1;
    bool boolean: 1;
    bool number: 1;
    bool bigInt: 1;
    bool string: 1;
    bool array: 1;
    bool object: 1;
    bool function: 1;
    bool arrayBuffer: 1;
    bool i8Array: 1;
    bool u8Array: 1;
    bool i16Array: 1;
    bool u16Array: 1;
    bool i32Array: 1;
    bool u32Array: 1;
    bool i64Array: 1;
    bool u64Array: 1;
    bool f32Array: 1;
    bool f64Array: 1;
  };
  int bit_fields;
};
static_assert(sizeof(ValueMask) == sizeof(int), "ValueMask does not have the correct size");
union FunctionAttributes {
  struct {
    bool throwing: 1;
    bool allocating: 1;
    bool suspending: 1;
    bool referencing: 1;
  };
  int bit_fields;
};
static_assert(sizeof(ValueMask) == sizeof(int), "FunctionAttributes does not have the correct size");
struct TypedArray {
  uint8_t* bytes;
  size_t byte_size;
  NumberType type;
};
union BigIntFlags {
  struct {
    bool negative: 1;
    bool overflow: 1;
  };
  int bit_fields;
};
struct BigInt {
  BigIntFlags flags;
  int word_count;
  uint64_t words[1];
};

//-----------------------------------------------------------------------------
//  Data types that appear in the exported module struct
//-----------------------------------------------------------------------------
struct Call;
typedef void (*Thunk)(Call*);
typedef Result (*Factory)(Call*, Local<Value>*);
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
  Result (*get_this)(Call*, Local<Value>*);
  Result (*get_argument_count)(Call*, size_t*);
  Result (*get_argument)(Call*, size_t, Local<Value>*);
  Result (*set_return_value)(Call*, Local<Value>);

  Result (*get_slot_data)(Call*, size_t, void **);
  Result (*get_slot_object)(Call*, size_t, Local<Value>*);
  Result (*set_slot_data)(Call*, size_t, void *, size_t);
  Result (*set_slot_object)(Call*, size_t, Local<Value>);

  Result (*create_namespace)(Call*, Local<Object>*);
  Result (*create_class)(Call*, Local<String>, Thunk, Local<v8::Function>*);
  Result (*create_function)(Call*, Local<String>, size_t, Thunk, Local<v8::Function>*);
  Result (*create_enumeration)(Call*, Local<Object>*, ValueMask, Thunk, Local<v8::Function>*);

  Result (*add_construct)(Call*, Local<Object>, Local<String>, Local<Value>);
  Result (*add_accessors)(Call*, Local<Object>, Local<String>, Thunk, Thunk);
  Result (*add_static_accessors)(Call*, Local<Object>, Local<String>, Thunk, Thunk);
  Result (*add_enumeration_item)(Call*, Local<Object>, Local<String>, Local<Value>);

  Result (*create_object)(Call*, Local<v8::Function>, Local<Object>*);
  Result (*create_string)(Call*, const char*, Local<String>*);

  Result (*get_property)(Call*, Local<Object>, Local<String>, Local<Value>*);
  Result (*set_property)(Call*, Local<Object>, Local<String>, Local<Value>);
  
  Result (*get_array_length)(Call*, Local<Value>, size_t*);
  Result (*get_array_item)(Call*, size_t, Local<Value>, Local<Value>*);
  Result (*set_array_item)(Call*, size_t, Local<Value>, Local<Value>);
 
  Result (*allocate_memory)(Call*, size_t, ::TypedArray*);
  Result (*reallocate_memory)(Call*, size_t, ::TypedArray*);
  Result (*free_memory)(Call*, ::TypedArray*);

  Result (*is_value_type)(Local<Value>, ValueMask, bool*);
  
  Result (*unwrap_bool)(Call*, Local<Value>, bool*);
  Result (*unwrap_int32)(Call*, Local<Value>, int32_t*);
  Result (*unwrap_int64)(Call*, Local<Value>, int64_t*);
  Result (*unwrap_bigint)(Call*, Local<Value>, ::BigInt*);
  Result (*unwrap_double)(Call*, Local<Value>, double*);
  Result (*unwrap_string)(Call*, Local<Value>, ::TypedArray*);
  Result (*unwrap_typed_array)(Call*, Local<Value>, ::TypedArray*);

  Result (*wrap_bool)(Call*, bool, Local<Value>*);
  Result (*wrap_int32)(Call*, int32_t, Local<Value>*);
  Result (*wrap_int64)(Call*, uint64_t, Local<Value>*);
  Result (*wrap_bigint)(Call*, const ::BigInt&, Local<Value>*);
  Result (*wrap_double)(Call*, double, Local<Value>*);
  Result (*wrap_string)(Call*, const ::TypedArray&, Local<Value>*);
  Result (*wrap_typed_array)(Call*, const ::TypedArray&, Local<Value>*);

  Result (*throw_exception)(Call*, const char*);
};

//-----------------------------------------------------------------------------
//  Per isolate data structures attached to JS object
//-----------------------------------------------------------------------------
struct ModuleData {
  void *so_handle;  
  Global<External> external;
};

struct FunctionData  {  
  Thunk thunk;
  Global<Array> slot_data;
  Global<External> external;
};

struct SlotData {
  Global<External> external;
  uint64_t payload[0];
};

//-----------------------------------------------------------------------------
//  Structure used passed stuff to Zig code and back (per call)
//-----------------------------------------------------------------------------
struct Call {
  Isolate* isolate;  
  const FunctionCallbackInfo<Value>* v8_args;
  Local<Context> exec_context;
  Local<Array> mem_pool;
  FunctionData* zig_func;

  Call(const FunctionCallbackInfo<Value> &info) {
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