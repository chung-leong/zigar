#include "addon.h"

template<typename T>
inline T GetExternalData(const FunctionCallbackInfo<Value>& info) {
  void* data = info.Data().As<External>()->Value();
  return reinterpret_cast<T>(data);
}

static Local<String> NewString(Isolate* isolate, const char* s) {
  return String::NewFromUtf8(isolate, s).ToLocalChecked();
}

static Local<Number> NewInteger(Isolate* isolate, int64_t value, bool is_signed) {
  // TODO: avoid double when possible
  return Number::New(isolate, (double) value);
}

static Local<Value> AllocateExternal(Isolate* isolate, size_t count) {
  struct SetWeakCallbackData {
    Global<Value> global;
    int64_t payload[1]; 
  };
  // allocate enough memory to hold the global and the payload
  size_t total_size = sizeof(SetWeakCallbackData) - sizeof(int64_t) + count;
  uint8_t* bytes = new uint8_t[total_size];
  memset(bytes, 0, total_size);
  SetWeakCallbackData *callback_data = reinterpret_cast<SetWeakCallbackData *>(bytes);
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

static Local<v8::Function> NewFunction(Isolate* isolate, FunctionCallback f, int len, void* data) {
  Local<External> external;
  if (data) {
    external = External::New(isolate, data);
  }
  Local<Signature> signature;
  Local<FunctionTemplate> ftmpl = FunctionTemplate::New(isolate, f, external, signature, len);
  return ftmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
}

static ::TypedArray GetMemory(Local<ArrayBuffer> arBuf) {
  std::shared_ptr<BackingStore> store = arBuf->GetBackingStore();
  ::TypedArray array;
  array.type = ElementType::u8;
  array.bytes = reinterpret_cast<uint8_t*>(store->Data());
  array.len = store->ByteLength();
  return array;
}

static size_t GetArgumentCount(const FunctionCallbackInfo<Value>& info) {
  return info.Length();
}

static Local<Value> GetArgument(const FunctionCallbackInfo<Value>& info, size_t index) {
  return info[index];
}

static ValueTypes GetArgumentType(const FunctionCallbackInfo<Value>& info, size_t index) {
  FunctionData* fd = GetExternalData<FunctionData*>(info);
  return fd->argument_types[index];
}

static ValueTypes GetReturnType(const FunctionCallbackInfo<Value>& info) {
  FunctionData* fd = GetExternalData<FunctionData*>(info);
  return fd->return_type;
}

static void SetReturnValue(const FunctionCallbackInfo<Value>& info, Local<Value> value) {
  if (!value.IsEmpty()) {
    info.GetReturnValue().Set(value);
  }
}

static Result GetProperty(Isolate* isolate, const char *name, Local<Value> object, Local<Value>* dest) {
  Local<Context> context = isolate->GetCurrentContext();
  MaybeLocal<Value> result = object.As<Object>()->Get(context, NewString(isolate, name));
  if (result.IsEmpty()) {
    return Result::failure;
  }
  *dest = result.ToLocalChecked();
  return Result::success;
}

static Result SetProperty(Isolate* isolate, const char *name, Local<Value> object, Local<Value> value) {
  Local<Context> context = isolate->GetCurrentContext();
  object.As<Object>()->Set(context, NewString(isolate, name), value).Check();
  return Result::success;
}

static Result AllocateMemory(Isolate* isolate, Local<Array>& pool, size_t size, ::TypedArray* dest) {
  if (pool.IsEmpty()) {
    pool = Array::New(isolate);
  }
  Local<ArrayBuffer> buffer = ArrayBuffer::New(isolate, size);
  uint32_t index = pool->Length();
  Local<Context> context = isolate->GetCurrentContext();
  pool->Set(context, index, buffer).Check();
  *dest = GetMemory(buffer);
  return Result::success;
}

static bool IsNull(Local<Value> value) {
  return value->IsNullOrUndefined();
}

static bool IsString(Local<Value> value) {
  return value->IsString();
}

static bool IsArray(Local<Value> value) {
  return value->IsArray();
}

static bool IsObject(Local<Value> value) {
  return value->IsObject();
}

static bool IsArrayBuffer(Local<Value> value) {
  return value->IsArrayBuffer() || value->IsTypedArray();
}

static bool MatchValueTypes(Local<Value> value, ValueTypes types) {
  auto match = [&](ValueTypes type) { return (INT(types) & INT(type)) != 0; };
  return (match(ValueTypes::boolean) && value->IsBoolean())
      || (match(ValueTypes::number) && value->IsNumber())
      || (match(ValueTypes::bigInt) && value->IsBigInt())
      || (match(ValueTypes::string) && value->IsString())
      || (match(ValueTypes::array) && value->IsArray())
      || (match(ValueTypes::object) && value->IsObject())
      || (match(ValueTypes::function) && value->IsFunction())
      || (match(ValueTypes::arrayBuffer) && value->IsArrayBuffer())
      || (match(ValueTypes::i8Array) && value->IsInt8Array())
      || (match(ValueTypes::u8Array) && (value->IsUint8Array() || value->IsUint8ClampedArray()))
      || (match(ValueTypes::i16Array) && value->IsInt16Array())
      || (match(ValueTypes::u16Array) && value->IsUint16Array())
      || (match(ValueTypes::i32Array) && value->IsInt32Array())
      || (match(ValueTypes::u32Array) && value->IsUint32Array())
      || (match(ValueTypes::i64Array) && value->IsBigInt64Array())
      || (match(ValueTypes::u64Array) && value->IsBigUint64Array())
      || (match(ValueTypes::f32Array) && value->IsFloat32Array())
      || (match(ValueTypes::f64Array) && value->IsFloat64Array());
}

static Result ConvertToBool(Isolate* isolate, Local<Value> value, bool* dest) {
  Local<Boolean> boolean;
  if (value->IsBoolean()) {
    boolean = value.As<Boolean>();
  } else {
    MaybeLocal<Boolean> result = value->ToBoolean(isolate);
    if (result.IsEmpty()) {
      return Result::failure;
    }
    boolean = result.ToLocalChecked();
  }
  *dest = boolean->Value();
  return Result::success;
}

static Result ConvertFromBool(Isolate* isolate, bool value, Local<Value>* dest) {
  *dest = Boolean::New(isolate, value);
  return Result::success;
}

static Result ConvertToI32(Isolate* isolate, Local<Value> value, int32_t* dest) {
  Local<Int32> number;
  if (value->IsInt32()) {
    number = value.As<Int32>();
  } else {
    MaybeLocal<Int32> result = value->ToInt32(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    number = result.ToLocalChecked();
  }
  *dest = number->Value();
  return Result::success;
}

static Result ConvertFromI32(Isolate* isolate, int32_t value, Local<Value>* dest) {
  *dest = Int32::New(isolate, value);
  return Result::success;
}

static Result ConvertToU32(Isolate* isolate, Local<Value> value, uint32_t* dest) {
  Local<Uint32> number;
  if (value->IsUint32()) {
    number = value.As<Uint32>();
  } else {
    MaybeLocal<Uint32> result = value->ToUint32(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    number = result.ToLocalChecked();
  }
  *dest = number->Value();
  return Result::success;
}

static Result ConvertFromU32(Isolate* isolate, uint32_t value, Local<Value>* dest) {
  *dest = Uint32::NewFromUnsigned(isolate, value);
  return Result::success;
}

static Result ConvertToF64(Isolate* isolate, Local<Value> value, double* dest) {
  Local<Number> number;
  if (value->IsNumber()) {
    number = value.As<Number>();
  } else {
    MaybeLocal<Number> result = value->ToNumber(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    number = result.ToLocalChecked();
  }
  *dest = number->Value();
  return Result::success;
}

static Result ConvertFromF64(Isolate* isolate, double value, Local<Value>* dest) {
  *dest = Number::New(isolate, value);
  return Result::success;
}

static Result ConvertToUTF8(Isolate* isolate, Local<Array>& pool, Local<Value> value, ::TypedArray* dest) {
  Local<String> string;
  if (value->IsString()) {
    string = value.As<String>();
  } else {
    MaybeLocal<String> result = value->ToString(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    string = result.ToLocalChecked();
  }
  size_t len = string->Length();
  if (AllocateMemory(isolate, pool, (len + 1) * sizeof(uint8_t), dest) != Result::success) {
    return Result::failure;
  }
  string->WriteUtf8(isolate, reinterpret_cast<char*>(dest->bytes));
  return Result::success;
}

static Result ConvertToUTF16(Isolate* isolate, Local<Array>& pool, Local<Value> value, ::TypedArray* dest) {
  Local<String> string;
  if (value->IsString()) {
    string = value.As<String>();
  } else {
    MaybeLocal<String> result = value->ToString(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    string = result.ToLocalChecked();
  }
  size_t len = string->Length();
  if (AllocateMemory(isolate, pool, (len + 1) * sizeof(uint16_t), dest) != Result::success) {
    return Result::failure;
  }
  string->Write(isolate, reinterpret_cast<uint16_t*>(dest->bytes));
  return Result::success;
}

static size_t GetElementSize(ElementType type) {
  switch (type) {
    case ElementType::unknown: 
    case ElementType::i8: 
    case ElementType::u8: 
      return 1;
    case ElementType::i16: 
    case ElementType::u16: 
      return 2;
    case ElementType::i32: 
    case ElementType::u32: 
    case ElementType::f32: 
      return 4;
    case ElementType::i64: 
    case ElementType::u64: 
    case ElementType::f64: 
      return 8;
  }
  return 0;
}
static Result ConvertToTypedArray(Isolate* isolate, Local<Value> value, ::TypedArray* dest) {
  Local<ArrayBuffer> buffer;
  ElementType type = dest->type;
  size_t offset = 0;
  if (value->IsArrayBuffer()) {
    buffer = value.As<ArrayBuffer>();
  } else if (value->IsTypedArray()) {
    buffer = value.As<v8::TypedArray>()->Buffer();
    offset = value.As<v8::TypedArray>()->ByteOffset();
  } else {
    return Result::failure;
  }    
  // leave type as uint8 as we need the actual byte-count while performing pointer conversion in Zig
  *dest = GetMemory(buffer);
  if (offset > 0) {
    const size_t element_size = GetElementSize(type);
    const size_t byte_count = offset >> (element_size - 1);
    dest->bytes += byte_count;
    dest->len -= byte_count;
  }
  return Result::success;
}

static void ThrowException(Isolate* isolate, const char* message) {
  Local<Value> error = Exception::Error(NewString(isolate, message));
  isolate->ThrowException(error);
}

static void Run(const FunctionCallbackInfo<Value>& info) {
  FunctionData* fd = GetExternalData<FunctionData*>(info);
  Isolate* isolate = info.GetIsolate();
  Local<Array> pool;
  Thunk thunk = fd->entry.function->thunk;
  thunk(isolate, info, pool);
}

static void Get(const FunctionCallbackInfo<Value>& info) {
  FunctionData* fd = GetExternalData<FunctionData*>(info);
  Isolate* isolate = info.GetIsolate();
  Local<Array> pool;
  Thunk thunk = fd->entry.variable->getter_thunk;
  thunk(isolate, info, pool);
}

static void Set(const FunctionCallbackInfo<Value>& info) {
  FunctionData* fd = GetExternalData<FunctionData*>(info);
  Isolate* isolate = info.GetIsolate();
  Local<Array> pool;
  Thunk thunk = fd->entry.variable->setter_thunk;
  thunk(isolate, info, pool);
}

static Local<Value> ProcessEntryTable(Isolate* isolate, EntryTable *table) {
  Local<Value> object = Object::New(isolate);
  for (size_t i = 0; i < table->count; i++) {
    const Entry *entry = &table->entries[i];
    // allocate memory for FunctionData struct, enough for holding the current 
    // type set for each argument
    size_t arg_count;
    switch (entry->type) {
      case EntryType::function:
        arg_count = entry->function->argument_count;
        break;
      case EntryType::variable:
        arg_count = 1;
        break;
      default:
        arg_count = 0;
    }
    size_t size = sizeof(FunctionData) + sizeof(ValueTypes) * arg_count;
    Local<Value> external = AllocateExternal(isolate, size);
    FunctionData *fd = reinterpret_cast<FunctionData*>(external.As<External>()->Value());
    fd->entry = *entry;
    switch (entry->type) {
      case EntryType::function: {
        // save argument and return types
        const Argument *args = entry->function->arguments;
        for (size_t i = 0; i < arg_count; i++) {
          fd->argument_types[i] = args[i].default_type;
        }
        fd->return_type = entry->function->return_default_type;
        Local<v8::Function> function = NewFunction(isolate, Run, arg_count, fd);
        SetProperty(isolate, entry->name, object, function);
      } break;
      case EntryType::variable: {
        fd->argument_types[0] = entry->variable->default_type;
        fd->return_type = entry->variable->default_type;
        PropertyAttribute attribute = static_cast<PropertyAttribute>(DontDelete | ReadOnly);
        Local<v8::Function> getter, setter;
        if (entry->variable->getter_thunk) {
          getter = NewFunction(isolate, Get, 0, fd);
        }
        if (entry->variable->setter_thunk) {
          setter = NewFunction(isolate, ::Set, 1, fd);
          attribute = static_cast<PropertyAttribute>(attribute & ~ReadOnly);
        }
        Local<String> name = NewString(isolate, entry->name);
        object.As<Object>()->SetAccessorProperty(name, getter, setter, attribute);
      } break;
      case EntryType::enumeration: {
        fd->return_type = entry->enumeration->default_type;
        Local<Value> enumeration = Object::New(isolate);
        for (size_t i = 0; i < entry->enumeration->count; i++) {
          const EnumerationItem* item = &entry->enumeration->items[i];
          Local<Number> number = NewInteger(isolate, item->value, entry->enumeration->is_signed);
          SetProperty(isolate, item->name, enumeration, number);
        }
        SetProperty(isolate, entry->name, object, enumeration);
      } break;
      case EntryType::unavailable:
        break;
    }
  }
  return object;
}

static void UnloadLibrary(void *handle) {
    dlclose(handle);
}

static void Load(const FunctionCallbackInfo<Value>& info) {
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
  callbacks->is_string = IsString;
  callbacks->is_object = IsObject;
  callbacks->is_array = IsArray;
  callbacks->is_array_buffer = IsArrayBuffer;
  callbacks->match_value_types = MatchValueTypes;
  callbacks->get_property = GetProperty;
  callbacks->set_property = SetProperty;
  callbacks->convert_to_bool = ConvertToBool;
  callbacks->convert_to_i32 = ConvertToI32;
  callbacks->convert_to_u32 = ConvertToU32;
  callbacks->convert_to_i64 = nullptr;
  callbacks->convert_to_u64 = nullptr;
  callbacks->convert_to_f64 = ConvertToF64;
  callbacks->convert_to_utf8 = ConvertToUTF8;
  callbacks->convert_to_utf16 = ConvertToUTF16;
  callbacks->convert_to_typed_array = ConvertToTypedArray;
  callbacks->convert_from_bool = ConvertFromBool;
  callbacks->convert_from_i32 = ConvertFromI32;
  callbacks->convert_from_u32 = ConvertFromU32;
  callbacks->convert_from_i64 = nullptr;
  callbacks->convert_from_u64 = nullptr;
  callbacks->convert_from_f64 = ConvertFromF64;
  callbacks->convert_from_utf8 = nullptr; // ConvertFromUTF8;
  callbacks->convert_from_utf16 = nullptr; // ConvertFromUTF16;
  callbacks->convert_from_typed_array = nullptr; // ConvertFromTypedArray;

  callbacks->throw_exception = ThrowException;

  // process all entries inside modules
  Local<Value> value = ProcessEntryTable(isolate, &module->table);
  info.GetReturnValue().Set(value);

  // unload shared library on shutdown
  node::AddEnvironmentCleanupHook(isolate, UnloadLibrary, handle);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  Isolate* isolate = context->GetIsolate();
  Local<v8::Function> function = NewFunction(isolate, Load, 1, NULL);
  SetProperty(isolate, "load", exports, function);
} 
