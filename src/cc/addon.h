#include <node.h>
#include <dlfcn.h>

#define MAX_SAFE_INTEGER  9007199254740991
#define MIN_SAFE_INTEGER  -9007199254740991

using namespace v8;

//-----------------------------------------------------------------------------
//  Enum and structs used by both Zig and C++ code
//  (need to keep these in sync with their Zig definitions)
//-----------------------------------------------------------------------------
enum class Result : int {
  ok = 0,
  eGeneric = 1,
  eOverflow = 2,
};
enum class ElementType : int {
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
  size_t len;
  ElementType type;
};

//-----------------------------------------------------------------------------
//  Data types that appear in the exported module struct
//-----------------------------------------------------------------------------
typedef void (*Thunk)(CallContext*);
enum class EntryType : int {
  unavailable = 0,
  function,
  variable,
  enumeration,
};
struct Argument {
  ValueMask default_type;
  ValueMask possible_type;
  const char* class_name;
};
struct Function {
  Thunk thunk;
  FunctionAttributes attributes;
  const Argument* arguments;
  size_t argument_count;
  ValueMask return_default_type;
  ValueMask return_possible_type;
  const char* return_class_name;
};
struct Variable {
  Thunk getter_thunk;
  Thunk setter_thunk;
  ValueMask default_type;
  ValueMask possible_type;
  const char* class_name;
};
struct EnumerationItem {
  const char* name;
  int64_t value;
};
struct Enumeration {
  const EnumerationItem* items;
  size_t count;
  int is_signed;
  ValueMask default_type;
  ValueMask possible_type;
};
struct Entry {
  const char* name;
  EntryType type;
  union {
    ::Function* function;
    Variable* variable;
    Enumeration* enumeration;
  };
};
struct EntryTable {
  const Entry* entries;
  size_t count;
};
struct Callbacks;
struct Module {
  int version;
  Callbacks* callbacks;
  EntryTable table;
};

//-----------------------------------------------------------------------------
//  Function-pointer table used by Zig code
//-----------------------------------------------------------------------------
struct CallContext;
struct Callbacks {  
  size_t (*get_argument_count)(CallContext*);
  Local<Value> (*get_argument)(CallContext*, size_t);
  ValueMask (*get_argument_type)(CallContext*, size_t);
  ValueMask (*get_return_type)(CallContext*);
  void (*set_return_value)(CallContext*, Local<Value> value);
  
  Result (*allocate_memory)(CallContext*, size_t size, ::TypedArray*);
  Result (*reallocate_memory)(CallContext*, size_t size, ::TypedArray*);
  Result (*free_memory)(CallContext*, ::TypedArray*);

  bool (*is_null)(Local<Value>);
  bool (*is_value_type)(Local<Value>, ValueMask);

  Result (*get_property)(CallContext*, const char*, Local<Value>, Local<Value>*);
  Result (*set_property)(CallContext*, const char*, Local<Value>, Local<Value>);

  Result (*get_array_length)(CallContext*, Local<Value>, size_t*);
  Result (*get_array_item)(CallContext*, size_t, Local<Value>, Local<Value>*);
  Result (*set_array_item)(CallContext*, size_t, Local<Value>, Local<Value>);
  
  Result (*convert_to_bool)(CallContext*, Local<Value>, bool*);
  Result (*convert_to_integer)(CallContext*, Local<Value>, int64_t*);
  Result (*convert_to_float)(CallContext*, Local<Value>, double*);
  Result (*convert_to_utf8)(CallContext*, Local<Value>, ::TypedArray*);
  Result (*convert_to_utf16)(CallContext*, Local<Value>, ::TypedArray*);
  Result (*convert_to_typed_array)(CallContext*, Local<Value>, ::TypedArray*);

  Result (*convert_from_bool)(CallContext*, bool, Local<Value>*);
  Result (*convert_from_integer)(CallContext*, int64_t, Local<Value>*);
  Result (*convert_from_float)(CallContext*, double, Local<Value>*);
  Result (*convert_from_utf8)(CallContext*, Local<Array>&, ::TypedArray&, Local<Value>*);
  Result (*convert_from_utf16)(CallContext*, Local<Array>&, ::TypedArray&, Local<Value>*);
  Result (*convert_from_typed_array)(CallContext*, Local<Array>&, ::TypedArray&, Local<Value>*);

  void (*throw_exception)(CallContext*, const char*);
};

//-----------------------------------------------------------------------------
//  Structure used to keep track of type conversion settings (per isolate)
//  Gets garbage-collected alongside the function the struct is attached to
//-----------------------------------------------------------------------------
struct FunctionData  {  
  Entry entry;
  ValueMask return_type;
  ValueMask argument_types[0];
};

//-----------------------------------------------------------------------------
//  Structure used passed stuff to Zig code and back (per call)
//-----------------------------------------------------------------------------
struct CallContext {
  Isolate* isolate;  
  const FunctionCallbackInfo<Value>* node_args;
  Local<Context> exec_context;
  Local<Array> mem_pool;
  FunctionData* zig_func;

  CallContext(const FunctionCallbackInfo<Value> &info) {
    node_args = &info;
    isolate = info.GetIsolate();
    exec_context = isolate->GetCurrentContext();
    zig_func = reinterpret_cast<FunctionData*>(info.Data().As<External>()->Value());
  }
};