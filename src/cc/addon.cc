#include <limits>
#include <cmath>
#include "addon.h"

//-----------------------------------------------------------------------------
//  Utility functions
//-----------------------------------------------------------------------------
static Local<String> 
NewString(Isolate* isolate, const char* s) {
  return String::NewFromUtf8(isolate, s).ToLocalChecked();
}

static Local<Number> 
NewInteger(Isolate* isolate, int64_t value) {
  if (value >= INT32_MIN && value <= INT32_MAX) {
    return Int32::New(isolate, static_cast<int64_t>(value));
  } else if (value >= MIN_SAFE_INTEGER && value <= MAX_SAFE_INTEGER) {
    return Number::New(isolate, (double) value);
  } else {
    return Number::New(isolate, std::numeric_limits<double>::quiet_NaN());
  }
}

static Local<v8::Function> 
NewFunction(Isolate* isolate, FunctionCallback f, int len, Local<Value> data = Local<Value>()) {
  Local<Signature> signature;
  Local<FunctionTemplate> ftmpl = FunctionTemplate::New(isolate, f, data, signature, len);
  return ftmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
}

static void 
SetProperty(Isolate* isolate, const char* name, Local<Value> object, Local<Value> value) {
  Local<String> key = NewString(isolate, name);
  object.As<Object>()->Set(isolate->GetCurrentContext(), key, value).Check();
}

static void 
ThrowException(Isolate* isolate, const char* message) {
  Local<String> string = NewString(isolate, message);
  Local<Value> error = Exception::Error(string);
  isolate->ThrowException(error);
}

static Local<Value> 
AllocateExternal(Isolate* isolate, size_t count) {
  struct SetWeakCallbackData {
    Global<Value> global;
    int64_t payload[1]; 
  };
  // allocate enough memory to hold the global and the payload
  size_t total_size = sizeof(SetWeakCallbackData) - sizeof(int64_t) + count;
  uint8_t* bytes = new uint8_t[total_size];
  memset(bytes, 0, total_size);
  SetWeakCallbackData* callback_data = reinterpret_cast<SetWeakCallbackData*>(bytes);
  // create a v8::External and attach it to global ref
  Local<Value> external = External::New(isolate, callback_data->payload);
  callback_data->global.Reset(isolate, external);
  // use SetWeak to invoke a callback when the External gets gc'ed
  auto callback = [](const v8::WeakCallbackInfo<SetWeakCallbackData>& data) {
    SetWeakCallbackData* callback_data = data.GetParameter();
    callback_data->global.Reset();
    delete callback_data;
  };
  callback_data->global.template 
    SetWeak<SetWeakCallbackData>(callback_data, callback, WeakCallbackType::kParameter);
  return external;
}

static ::TypedArray 
GetMemory(Local<ArrayBuffer> arBuf) {
  std::shared_ptr<BackingStore> store = arBuf->GetBackingStore();
  ::TypedArray array;
  array.type = NumberType::u8;
  array.bytes = reinterpret_cast<uint8_t*>(store->Data());
  array.byte_size = store->ByteLength();
  return array;
}

//-----------------------------------------------------------------------------
//  Callback functions that zig modules will invoke
//-----------------------------------------------------------------------------
static size_t 
GetArgumentCount(Call* call) {
  return call->node_args->Length();
}

static Local<Value> 
GetArgument(Call* call, size_t index) {
  Local<Value> value = (*call->node_args)[index];
  // unwrap scalar objects
  if (value->IsBooleanObject()) {
    value = Boolean::New(call->isolate, value.As<BooleanObject>()->ValueOf());
  } else if (value->IsStringObject()) {
    value = value.As<StringObject>()->ValueOf();
  } else if (value->IsNumberObject()) {
    value = Number::New(call->isolate, value.As<NumberObject>()->ValueOf());
  } else if (value->IsBigIntObject()) {
    value = value.As<BigIntObject>()->ValueOf();
  }
  return value;
}

static ValueMask 
GetArgumentType(Call* call, size_t index) {
  return call->zig_func->argument_types[index];
}

static ValueMask 
GetReturnType(Call* call) {
  return call->zig_func->return_type;
}

static void 
SetReturnValue(Call* call, Local<Value> value) {
  if (!value.IsEmpty()) {
    call->node_args->GetReturnValue().Set(value);
  }
}

static Result 
GetProperty(Call* call, const char* name, Local<Value> object, Local<Value>* dest) {
  Local<Value> key = NewString(call->isolate, name);
  MaybeLocal<Value> result = object.As<Object>()->Get(call->exec_context, key);
  if (result.IsEmpty()) {
    return Result::failure;
  }
  *dest = result.ToLocalChecked();
  return Result::ok;
}

static Result
SetProperty(Call* call, const char* name, Local<Value> object, Local<Value> value) {
  Local<Value> key = NewString(call->isolate, name);
  object.As<Object>()->Set(call->exec_context, key, value).Check();
  return Result::ok;
}

static Result
AllocateMemory(Call* call, size_t size, ::TypedArray* dest) {
  if (call->mem_pool.IsEmpty()) {
    call->mem_pool = Array::New(call->isolate);
  }
  Local<ArrayBuffer> buffer = ArrayBuffer::New(call->isolate, size);
  uint32_t index = call->mem_pool->Length();
  call->mem_pool->Set(call->exec_context, index, buffer).Check();
  *dest = GetMemory(buffer);
  return Result::ok;
}

static bool 
IsNull(Local<Value> value) {
  return value->IsNullOrUndefined();
}

static bool 
IsValueType(Local<Value> value, ValueMask mask) {
  bool match = (mask.boolean && value->IsBoolean())
            || (mask.number && value->IsNumber())
            || (mask.bigInt && value->IsBigInt())
            || (mask.string && value->IsString())
            || (mask.array && value->IsArray())
            || (mask.object && value->IsObject())
            || (mask.function && value->IsFunction())
            || (mask.arrayBuffer && value->IsArrayBuffer())
            || (mask.i8Array && value->IsInt8Array())
            || (mask.u8Array && (value->IsUint8Array() || value->IsUint8ClampedArray()))
            || (mask.i16Array && value->IsInt16Array())
            || (mask.u16Array && value->IsUint16Array())
            || (mask.i32Array && value->IsInt32Array())
            || (mask.u32Array && value->IsUint32Array())
            || (mask.i64Array && value->IsBigInt64Array())
            || (mask.u64Array && value->IsBigUint64Array())
            || (mask.f32Array && value->IsFloat32Array())
            || (mask.f64Array && value->IsFloat64Array());
  return match;
}

static Result 
UnwrapBool(Call* call, Local<Value> value, bool* dest) {
  if (value->IsBoolean()) {
    *dest = value.As<Boolean>()->Value();
    return Result::ok;
  }
  return Result::failure;
}

static Result 
WrapBool(Call* call, bool value, Local<Value>* dest) {
  *dest = Boolean::New(call->isolate, value);
  return Result::ok;
}

static Result 
UnwrapInt32(Call* call, Local<Value> value, int32_t* dest) {
  if (value->IsInt32()) {
    *dest = value.As<Int32>()->Value();
    return Result::ok;
  }
  return Result::failure;
}

static Result 
WrapInt32(Call* call, int32_t value, Local<Value>* dest) {
  *dest = Int32::New(call->isolate, value);
  return Result::ok;
}

static Result 
UnwrapDouble(Call* call, Local<Value> value, double* dest) {
  if (value->IsNumber()) {
    *dest = value.As<Number>()->Value();
    return Result::ok;
  }
  return Result::failure;
}

static Result 
WrapDouble(Call* call, double value, Local<Value>* dest) {
  *dest = Number::New(call->isolate, value);
  return Result::ok;
}

static Result 
UnwrapBigInt(Call* call, Local<Value> value, ::BigInt* dest) {
  if (value->IsBigInt()) {
    int word_count = dest->word_count;
    int sign_bit = 0;
    uint64_t *words = dest->words;
    value.As<v8::BigInt>()->ToWordsArray(&sign_bit, &word_count, words);
    dest->flags.overflow = (word_count > dest->word_count);
    dest->flags.negative = !!sign_bit;
    return Result::ok;
  }
  return Result::failure;
}

static Result
WrapBigInt(Call* call, const ::BigInt& value, Local<Value>* dest) {
  int word_count = value.word_count;
  int sign_bit = value.flags.negative ? 1 : 0;
  const uint64_t *words = value.words;
  MaybeLocal<v8::BigInt> result = v8::BigInt::NewFromWords(call->exec_context, sign_bit, word_count, words);
  if (result.IsEmpty()) {
    return Result::failure;
  }
  *dest = result.ToLocalChecked();
  return Result::ok;
}

static Result 
UnwrapString(Call* call, Local<Value> value, ::TypedArray* dest) {
  Local<String> string;
  NumberType dest_type = dest->type;
  if (value->IsString()) {
    string = value.As<String>();
  } else {
    MaybeLocal<String> result = value->ToString(call->exec_context);
    if (result.IsEmpty()) {
      return Result::failure;
    }
    string = result.ToLocalChecked();
  }
  size_t len = string->Length();
  size_t char_size = (dest_type == NumberType::u8) ? sizeof(uint8_t) : sizeof(uint16_t);
  if (AllocateMemory(call, (len + 1) * char_size, dest) != Result::ok) {
    return Result::failure;
  }
  if (dest_type == NumberType::u8) {
    string->WriteUtf8(call->isolate, reinterpret_cast<char*>(dest->bytes));
  } else {
    string->Write(call->isolate, reinterpret_cast<uint16_t*>(dest->bytes));
  }
  return Result::ok;
}

static Result
UnwrapTypedArray(Call* call, Local<Value> value, ::TypedArray* dest) {
  Local<ArrayBuffer> buffer;
  size_t offset = 0;
  if (value->IsArrayBuffer()) {
    buffer = value.As<ArrayBuffer>();
  } else if (value->IsTypedArray()) {
    buffer = value.As<v8::TypedArray>()->Buffer();
    offset = value.As<v8::TypedArray>()->ByteOffset();
  } else {
    return Result::failure;
  }    
  *dest = GetMemory(buffer);
  if (offset > 0) {
    dest->bytes += offset;
    dest->byte_size -= offset;
  }
  return Result::ok;
}

static Result
WrapTypedArray(Call* call, const ::TypedArray& value, Local<Value> *dest) {
  // since the Call struct is allocated on the stack, its address is the 
  // starting point of stack space used by Zig code
  size_t stack_top = reinterpret_cast<size_t>(call);
  size_t stack_bottom = reinterpret_cast<size_t>(&stack_top);
  size_t address = reinterpret_cast<size_t>(value.bytes);
  Local<ArrayBuffer> buffer;
  size_t offset = 0;
  if (stack_bottom < address && address < stack_top) {
    // need to copy data sitting on the stack
    buffer = ArrayBuffer::New(call->isolate, value.byte_size);
    ::TypedArray mem = GetMemory(buffer);
    memcpy(mem.bytes, value.bytes, value.byte_size);
  }
  if (buffer.IsEmpty()) {
    return Result::failure;
  }
  switch (value.type) {
    case NumberType::i8:
      *dest = Int8Array::New(buffer, offset, value.byte_size / sizeof(int8_t));
      break;
    case NumberType::u8:
      *dest = Uint8Array::New(buffer, offset, value.byte_size / sizeof(uint8_t));
      break;
    case NumberType::i16:
      *dest = Int16Array::New(buffer, offset, value.byte_size / sizeof(int16_t));
      break;
    case NumberType::u16:
      *dest = Uint16Array::New(buffer, offset, value.byte_size / sizeof(uint16_t));
      break;
    case NumberType::i32:
      *dest = Int32Array::New(buffer, offset, value.byte_size / sizeof(int32_t));
      break;
    case NumberType::u32:
      *dest = Uint32Array::New(buffer, offset, value.byte_size / sizeof(uint32_t));
      break;
    case NumberType::i64:
      *dest = BigInt64Array::New(buffer, offset, value.byte_size / sizeof(int64_t));
      break;
    case NumberType::u64:
      *dest = BigUint64Array::New(buffer, offset, value.byte_size / sizeof(uint64_t));
      break;
    case NumberType::f32:
      *dest = Float32Array::New(buffer, offset, value.byte_size / sizeof(float));
      break;
    case NumberType::f64:
      *dest = Float64Array::New(buffer, offset, value.byte_size / sizeof(double));
      break;
    default:
      *dest = buffer;
  }
  return Result::ok;
}

static void 
ThrowException(Call* call, const char* message) {
  Local<Value> error = Exception::Error(NewString(call->isolate, message));
  call->isolate->ThrowException(error);
}

//-----------------------------------------------------------------------------
//  Functions that create V8-to-Zig bridging functions
//-----------------------------------------------------------------------------
static FunctionData* 
AllocateFunctionData(Isolate* isolate, size_t arg_count, const Entry* entry, Local<Value>& external) {
  // allocate memory for the FunctionData struct, enough for holding the current 
  // type set for each argument
  size_t size = sizeof(FunctionData) + sizeof(ValueMask) * arg_count;
  external = AllocateExternal(isolate, size);
  auto fd = reinterpret_cast<FunctionData*>(external.As<External>()->Value());
  fd->entry = *entry;
  return fd;
}

static void
ProcessFunctionEntry(Isolate* isolate, const Entry* entry, Local<Value> container) {
  size_t arg_count = entry->function->argument_count;
  const Argument* args = entry->function->arguments;
  // save argument and return types
  Local<Value> external;
  FunctionData* fd = AllocateFunctionData(isolate, arg_count, entry, external);
  for (size_t i = 0; i < arg_count; i++) {
    fd->argument_types[i] = args[i].default_type;
  }
  fd->return_type = entry->function->return_default_type;
  // calls the Zig-generate thunk when V8 function is called
  Local<v8::Function> function = NewFunction(isolate, 
    [](const FunctionCallbackInfo<Value>& info) {
      Call ctx(info);
      ctx.zig_func->entry.function->thunk(&ctx);
    }, arg_count, external);
  SetProperty(isolate, entry->name, container, function);
}

static void 
ProcessVariableEntry(Isolate* isolate, const Entry* entry, Local<Value> container) {
  Local<Value> external;
  FunctionData* fd = AllocateFunctionData(isolate, 1, entry, external);
  fd->argument_types[0] = entry->variable->default_type;
  fd->return_type = entry->variable->default_type;
  PropertyAttribute attribute = static_cast<PropertyAttribute>(DontDelete | ReadOnly);
  Local<v8::Function> getter, setter;
  if (entry->variable->getter_thunk) {
    getter = NewFunction(isolate, 
      [](const FunctionCallbackInfo<Value>& info) {
        Call ctx(info);
        ctx.zig_func->entry.variable->getter_thunk(&ctx);
      }, 0, external);
  }
  if (entry->variable->setter_thunk) {
    setter = NewFunction(isolate, 
      [](const FunctionCallbackInfo<Value>& info) {
        Call ctx(info);
        ctx.zig_func->entry.variable->setter_thunk(&ctx);
      }, 1, external);
    attribute = static_cast<PropertyAttribute>(attribute & ~ReadOnly);
  }
  Local<String> name = NewString(isolate, entry->name);
  container.As<Object>()->SetAccessorProperty(name, getter, setter, attribute);
}

static void 
ProcessEnumerationEntry(Isolate* isolate, const Entry* entry, Local<Value> container) {
  Local<Value> external;
  FunctionData* fd = AllocateFunctionData(isolate, 0, entry, external);
  fd->return_type = entry->enumeration->default_type;
  Local<Value> enumeration = Object::New(isolate);
  for (size_t i = 0; i < entry->enumeration->count; i++) {
    const EnumerationItem* item = &entry->enumeration->items[i];
    Local<Number> number = NewInteger(isolate, item->value);
    SetProperty(isolate, item->name, enumeration, number);
  }
  SetProperty(isolate, entry->name, container, enumeration);
}

static Local<Value> 
ProcessEntryTable(Isolate* isolate, EntryTable* table) {
  Local<Value> object = Object::New(isolate);
  for (size_t i = 0; i < table->count; i++) {
    const Entry* entry = &table->entries[i];
    switch (entry->type) {
      case EntryType::function: 
        ProcessFunctionEntry(isolate, entry, object);
        break;
      case EntryType::variable: 
        ProcessVariableEntry(isolate, entry, object);
        break;
      case EntryType::enumeration:
        ProcessEnumerationEntry(isolate, entry, object);
        break;
      case EntryType::unavailable:
        break;
    }
  }
  return object;
}

//-----------------------------------------------------------------------------
//  Function for loading Zig modules
//-----------------------------------------------------------------------------
static void 
Load(const FunctionCallbackInfo<Value>& info) {
  Isolate* isolate = info.GetIsolate();

  // check arguments
  if (info.Length() < 1 || !info[0]->IsString()) {
    ThrowException(isolate, "Invalid arguments");
    return;
  }

  // load the shared library
	String::Utf8Value path(isolate, info[0]);
  void* handle = dlopen(*path, RTLD_LAZY);
  if (!handle) {
    ThrowException(isolate, "Unable to load shared library");
    return;
  }

  // find the zig module
  void* symbol = dlsym(handle, "zig_module");
  if (!symbol) {
    ThrowException(isolate, "Unable to find the symbol \"zig_module\"");
    return;
  }

  // attach callbacks to module
  ::Module* module = reinterpret_cast<::Module*>(symbol);
  Callbacks* callbacks = module->callbacks;
  callbacks->get_argument_count = GetArgumentCount;
  callbacks->get_argument = GetArgument;
  callbacks->get_argument_type = GetArgumentType;
  callbacks->get_return_type = GetReturnType;
  callbacks->set_return_value = SetReturnValue;
  callbacks->is_null = IsNull;
  callbacks->is_value_type = IsValueType;
  callbacks->get_property = GetProperty;
  callbacks->set_property = SetProperty;
  callbacks->get_array_length = nullptr;
  callbacks->get_array_item = nullptr;
  callbacks->set_array_item = nullptr;
  callbacks->unwrap_bool = UnwrapBool;
  callbacks->unwrap_int32 = UnwrapInt32;
  callbacks->unwrap_int64 = nullptr;
  callbacks->unwrap_bigint = UnwrapBigInt;
  callbacks->unwrap_double = UnwrapDouble;
  callbacks->unwrap_string = UnwrapString;
  callbacks->unwrap_typed_array = UnwrapTypedArray;
  callbacks->wrap_bool = WrapBool;
  callbacks->wrap_int32 = WrapInt32;
  callbacks->wrap_int64 = nullptr;
  callbacks->wrap_bigint = WrapBigInt;
  callbacks->wrap_double = WrapDouble;
  callbacks->wrap_string = nullptr; // WrapString;
  callbacks->wrap_typed_array = WrapTypedArray;

  callbacks->throw_exception = ThrowException;

  // process all entries inside modules
  Local<Value> value = ProcessEntryTable(isolate, &module->table);
  info.GetReturnValue().Set(value);

  // unload shared library on shutdown
  node::AddEnvironmentCleanupHook(isolate, [](void* handle) { 
    dlclose(handle); 
  }, handle);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  Isolate* isolate = context->GetIsolate();
  Local<v8::Function> function = NewFunction(isolate, Load, 1);
  SetProperty(isolate, "load", exports, function);
} 
