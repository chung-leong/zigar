#include <node.h>
#include <dlfcn.h>

#define INT(a) static_cast<int>(a)

using namespace v8;

enum class Result : int {
  success = 0,
  failure = 1,
  failureSizeMismatch = 2,
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
enum class ValueTypeBitPos {
  boolean = 0,
  number,
  bigInt,
  string,
  array,
  object,
  function,
  arrayBuffer,
};
enum class ValueTypes : int {
  empty = 0,
  boolean = 1 << INT(ValueTypeBitPos::boolean),
  number = 1 << INT(ValueTypeBitPos::number),
  bigInt = 1 << INT(ValueTypeBitPos::bigInt),
  string = 1 << INT(ValueTypeBitPos::string),
  array = 1 << INT(ValueTypeBitPos::array),
  object = 1 << INT(ValueTypeBitPos::object),
  function = 1 << INT(ValueTypeBitPos::function),
  arrayBuffer = 1 << INT(ValueTypeBitPos::arrayBuffer),
  i8Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::i8)),
  u8Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::u8)),
  i16Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::i16)),
  u16Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::u16)),
  i32Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::i32)),
  u32Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::u32)),
  i64Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::i64)),
  u64Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::u64)),
  f32Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::f32)),
  f64Array = 1 << (INT(ValueTypeBitPos::arrayBuffer) + INT(ElementType::f64)),
};
enum class FunctionAttributes : int {
  throwing = 1 << 0,
  allocating = 1 << 1,
  suspending = 1 << 2,
  referencing = 1 << 3,
};
struct TypedArray {
  uint8_t* bytes;
  size_t len;
  ElementType type;
};
struct Callbacks {  
  size_t (*get_argument_count)(const FunctionCallbackInfo<Value>&);
  Local<Value> (*get_argument)(const FunctionCallbackInfo<Value>&, size_t);
  ValueTypes (*get_argument_type)(const FunctionCallbackInfo<Value>&, size_t);
  ValueTypes (*get_return_type)(const FunctionCallbackInfo<Value>&);
  void (*set_return_value)(const FunctionCallbackInfo<Value>& info, Local<Value> value);
  
  Result (*allocate_memory)(Isolate*, Local<Array>&, size_t size, Local<Value>*);
  Result (*reallocate_memory)(Isolate*, Local<Array>&, size_t size, Local<Value>*);
  Result (*free_memory)(Isolate*, Local<Array>&, Local<Value>*);

  bool (*is_null)(Local<Value>);
  bool (*is_string)(Local<Value>);
  bool (*is_object)(Local<Value>);
  bool (*is_array)(Local<Value>);
  bool (*is_array_buffer)(Local<Value>);
  bool (*match_value_types)(Local<Value>, ValueTypes types);

  Result (*get_property)(Isolate*, const char*, Local<Value>, Local<Value>*);
  Result (*set_property)(Isolate*, const char*, Local<Value>, Local<Value>);

  Result (*convert_to_bool)(Isolate*, Local<Value>, bool*);
  Result (*convert_to_i32)(Isolate*, Local<Value>, int32_t*);
  Result (*convert_to_u32)(Isolate*, Local<Value>, uint32_t*);
  Result (*convert_to_i64)(Isolate*, Local<Value>, int64_t*);
  Result (*convert_to_u64)(Isolate*, Local<Value>, uint64_t*);
  Result (*convert_to_f64)(Isolate*, Local<Value>, double*);
  Result (*convert_to_utf8)(Isolate*, Local<Array>&, Local<Value>, ::TypedArray*);
  Result (*convert_to_utf16)(Isolate*, Local<Array>&, Local<Value>, ::TypedArray*);
  Result (*convert_to_typed_array)(Isolate*, Local<Value>, ::TypedArray*);

  Result (*convert_from_bool)(Isolate*, bool, Local<Value>*);
  Result (*convert_from_i32)(Isolate*, int32_t, Local<Value>*);
  Result (*convert_from_u32)(Isolate*, uint32_t, Local<Value>*);
  Result (*convert_from_i64)(Isolate*, int64_t, Local<Value>*);
  Result (*convert_from_u64)(Isolate*, uint64_t, Local<Value>*);
  Result (*convert_from_f64)(Isolate*, double, Local<Value>*);
  Result (*convert_from_utf8)(Isolate*, Local<Array>&, ::TypedArray&, Local<Value>*);
  Result (*convert_from_utf16)(Isolate*, Local<Array>&, ::TypedArray&, Local<Value>*);
  Result (*convert_from_typed_array)(Isolate*, Local<Array>&, ::TypedArray&, Local<Value>*);

  void (*throw_exception)(Isolate*, const char*);
};

typedef void (*Thunk)(Isolate*, const FunctionCallbackInfo<Value>&, Local<Array>&);

enum class EntryType : int {
  unavailable = 0,
  function,
  variable,
  enumeration,
};
struct Argument {
  ValueTypes default_type;
  ValueTypes possible_type;
  const char* class_name;
};
struct Function {
  Thunk thunk;
  FunctionAttributes attributes;
  const Argument* arguments;
  size_t argument_count;
  ValueTypes return_default_type;
  ValueTypes return_possible_type;
  const char* return_class_name;
};
struct Variable {
  Thunk getter_thunk;
  Thunk setter_thunk;
  ValueTypes default_type;
  ValueTypes possible_type;
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
  ValueTypes default_type;
  ValueTypes possible_type;
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
struct Module {
  int version;
  Callbacks* callbacks;
  EntryTable table;
};

struct FunctionData  {  
  Entry entry;
  ValueTypes return_type;
  ValueTypes argument_types[0];
};
