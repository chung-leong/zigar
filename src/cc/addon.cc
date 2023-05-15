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

static Local<v8::Function> NewFunction(Isolate* isolate, FunctionCallback f, int len, void* data) {
  Local<External> external = External::New(isolate, data);
  Local<Signature> signature;
  Local<FunctionTemplate> ftmpl = FunctionTemplate::New(isolate, f, external, signature, len);
  return ftmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
}

static ::TypedArray GetMemory(Local<ArrayBuffer> arBuf) {
  std::shared_ptr<BackingStore> store = arBuf->GetBackingStore();
  ::TypedArray array;
  array.type = TypedArrayType::u8;
  array.bytes = reinterpret_cast<uint8_t*>(store->Data());
  array.len = store->ByteLength();
  return array;
}

static size_t GetArgumentCount(const FunctionCallbackInfo<Value>& info) {
  return info.Length();
}

static ValueWithType GetArgument(const FunctionCallbackInfo<Value>& info, size_t index) {
  EntryData* f = GetExternalData<EntryData*>(info);
  ValueWithType arg;
  arg.value = info[index];
  arg.type = (index < f->argument_types.size()) ? f->argument_types[index] : ValueTypePresent::empty;
  return arg;
}

static ValueTypePresent GetReturnValueType(const FunctionCallbackInfo<Value>& info) {
  EntryData* f = GetExternalData<EntryData*>(info);
  return f->return_type;
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

static bool IsArrayBuffer(Local<Value> value) {
  return value->IsArrayBuffer() || value->IsTypedArray();
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

static bool isTypedArrayType(Local<Value> value, TypedArrayType type) {
  switch (type) {
    case TypedArrayType::unknown: 
      return value->IsInt8Array() || value->IsUint8Array();
    case TypedArrayType::i8: 
      return value->IsInt8Array();
    case TypedArrayType::u8: 
      return value->IsUint8Array() || value->IsUint8ClampedArray();
    case TypedArrayType::i16: 
      return value->IsInt16Array();
    case TypedArrayType::u16: 
      return value->IsUint16Array();
    case TypedArrayType::i32: 
      return value->IsInt32Array();
    case TypedArrayType::u32: 
      return value->IsUint32Array();
    case TypedArrayType::f32: 
      return value->IsFloat32Array();
    case TypedArrayType::i64: 
      return value->IsBigInt64Array();
    case TypedArrayType::u64: 
      return value->IsBigUint64Array();
    case TypedArrayType::f64: 
      return value->IsFloat64Array();
  }
  return false;
}

static size_t GetElementSize(TypedArrayType type) {
  switch (type) {
    case TypedArrayType::unknown: 
    case TypedArrayType::i8: 
    case TypedArrayType::u8: 
      return 1;
    case TypedArrayType::i16: 
    case TypedArrayType::u16: 
      return 2;
    case TypedArrayType::i32: 
    case TypedArrayType::u32: 
    case TypedArrayType::f32: 
      return 4;
    case TypedArrayType::i64: 
    case TypedArrayType::u64: 
    case TypedArrayType::f64: 
      return 8;
  }
  return 0;
}
static Result ConvertToTypedArray(Isolate* isolate, Local<Value> value, ::TypedArray* dest) {
  Local<ArrayBuffer> buffer;
  TypedArrayType type = dest->type;
  size_t offset = 0;
  if (value->IsArrayBuffer()) {
    buffer = value.As<ArrayBuffer>();
  } else if (value->IsTypedArray() && isTypedArrayType(value, type)) {
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
  EntryData* f = GetExternalData<EntryData*>(info);
  Isolate* isolate = info.GetIsolate();
  Local<Array> pool;
  Thunk thunk = f->entry.function->thunk;
  thunk(isolate, info, pool);
}

static void Get(const FunctionCallbackInfo<Value>& info) {
  EntryData* v = GetExternalData<EntryData*>(info);
  Isolate* isolate = info.GetIsolate();
  Local<Array> pool;
  Thunk thunk = v->entry.variable->getter_thunk;
  thunk(isolate, info, pool);
}

static void Set(const FunctionCallbackInfo<Value>& info) {
  EntryData* v = GetExternalData<EntryData*>(info);
  Isolate* isolate = info.GetIsolate();
  Local<Array> pool;
  Thunk thunk = v->entry.variable->setter_thunk;
  thunk(isolate, info, pool);
}

static Local<Value> ProcessEntryTable(Isolate* isolate, EntryTable *table, ModuleData *md) {
  Local<Value> object = Object::New(isolate);
  for (size_t i = 0; i < table->count; i++) {
    const Entry *entry = &table->entries[i];
    md->entry_data.push_back({});
    EntryData *ed = &md->entry_data.back();
    switch (entry->type) {
      case EntryType::function: {
        // save argument and return types
        const Argument *args = entry->function->arguments;
        unsigned arg_count = entry->function->argument_count;
        ed->argument_types.reserve(arg_count);
        for (size_t i = 0; i < arg_count; i++) {
          ed->argument_types.push_back(args[i].default_type);
        }
        ed->return_type = entry->function->return_default_type;
        Local<v8::Function> function = NewFunction(isolate, Run, arg_count, ed);
        SetProperty(isolate, entry->name, object, function);
      } break;
      case EntryType::enumeration: {
        ed->return_type = entry->enumeration->default_type;
        Local<Value> enumeration = Object::New(isolate);
        for (size_t i = 0; i < entry->enumeration->count; i++) {
          const EnumerationItem* item = &entry->enumeration->items[i];
          Local<Number> number = NewInteger(isolate, item->value, entry->enumeration->is_signed);
          SetProperty(isolate, item->name, enumeration, number);
        }
        SetProperty(isolate, entry->name, object, enumeration);
      } break;
      case EntryType::variable: {
        ed->argument_types.push_back(entry->variable->default_type);
        ed->return_type = entry->variable->default_type;
        PropertyAttribute attribute = static_cast<PropertyAttribute>(DontDelete | ReadOnly);
        Local<v8::Function> getter, setter;
        if (entry->variable->getter_thunk) {
          getter = NewFunction(isolate, Get, 0, ed);
        }
        if (entry->variable->setter_thunk) {
          setter = NewFunction(isolate, ::Set, 1, ed);
          attribute = static_cast<PropertyAttribute>(attribute & ~ReadOnly);
        }
      } break;
      case EntryType::unavailable:
        break;
    }
  }
  return object;
}

static void Load(const FunctionCallbackInfo<Value>& info) {
  AddonData* ad = reinterpret_cast<AddonData*>(info.Data().As<External>()->Value());
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
  callbacks->get_return_value_type = GetReturnValueType;
  callbacks->set_return_value = SetReturnValue;
  callbacks->is_null = IsNull;
  callbacks->is_string = IsString;
  callbacks->is_array_buffer = IsArrayBuffer;
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
  callbacks->convert_from_f64 = nullptr; // ConvertFromF64;
  callbacks->convert_from_utf8 = nullptr; // ConvertFromUTF8;
  callbacks->convert_from_utf16 = nullptr; // ConvertFromUTF16;
  callbacks->convert_from_typed_array = nullptr; // ConvertFromTypedArray;

  callbacks->throw_exception = ThrowException;

  // process all entries inside modules
  ad->module_data.emplace_back();
  ModuleData *md = &ad->module_data.back();
  Local<Value> value = ProcessEntryTable(isolate, &module->table, md);
  info.GetReturnValue().Set(value);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  Isolate* isolate = context->GetIsolate();
  AddonData* data = new AddonData();
  node::AddEnvironmentCleanupHook(isolate, AddonData::DeleteInstance, data);

  Local<v8::Function> function = NewFunction(isolate, Load, 1, static_cast<void*>(data));
  SetProperty(isolate, "load", exports, function);
} 
