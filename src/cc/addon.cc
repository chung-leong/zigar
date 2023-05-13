#include <node.h>
#include <dlfcn.h>

using namespace v8;

enum class Result {
  success = 0,
  failure = 1,
};

struct Memory {
  size_t len;
  int8_t *bytes;
};

struct Callbacks {  
  Isolate* (*get_isolate)(const FunctionCallbackInfo<Value>&);
  size_t (*get_argument_count)(const FunctionCallbackInfo<Value>&);
  Local<Value> (*get_argument)(const FunctionCallbackInfo<Value>&, size_t);
  void (*set_return_value)(const FunctionCallbackInfo<Value>& info, Local<Value> value);
  
  bool (*is_null)(Isolate* isolate, Local<Value>);
  bool (*is_array_buffer)(Isolate* isolate, Local<Value>);

  Result (*convert_to_bool)(Isolate *, Local<Value>, bool *);
  Result (*convert_to_i32)(Isolate *, Local<Value>, int32_t *);
  Result (*convert_to_u32)(Isolate *, Local<Value>, uint32_t *);
  Result (*convert_to_i64)(Isolate *, Local<Value>, int64_t *);
  Result (*convert_to_u64)(Isolate *, Local<Value>, uint64_t *);
  Result (*convert_to_f64)(Isolate *, Local<Value>, double *);
  Result (*convert_to_utf8)(Isolate *, Local<Value>, Local<Array> &, Memory *);
  Result (*convert_to_utf16)(Isolate *, Local<Value>, Local<Array> &, Memory *);
  Result (*convert_to_buffer)(Isolate *, Local<Value>, Memory *);

  Result (*convert_from_bool)(Isolate *, bool, Local<Value> *);
  Result (*convert_from_i32)(Isolate *, int32_t, Local<Value> *);
  Result (*convert_from_u32)(Isolate *, uint32_t, Local<Value> *);
  Result (*convert_from_i64)(Isolate *, int64_t, Local<Value> *);
  Result (*convert_from_u64)(Isolate *, uint64_t, Local<Value> *);
  Result (*convert_from_f64)(Isolate *, double, Local<Value> *);

  void (*throw_exception)(Isolate *, const char *);
};

enum class EntryType {
  unavailable = 0,
  function,
  enumSet,
  enumValue,
  object,
  intValue,
  floatValue,
};
struct FunctionRecord {
  size_t arg_count;
  void (*thunk)(const FunctionCallbackInfo<Value>&, Local<Array>&);
};
struct EnumRecord {
  const char *name;
  int value;
};
struct EnumSet {
  const EnumRecord *records;
  size_t record_count;
};
struct Entry {
  const char *name;
  int type;
  union {
    FunctionRecord function;    
    EnumSet enum_set;
    int64_t int_value;
    double float_value;
  };
};
struct ZigModule {
  int version;
  Callbacks *callbacks;
  const Entry *entries;
  size_t entry_count;
};

static Isolate *GetIsolate(const FunctionCallbackInfo<Value>& info) {
  return info.GetIsolate();
}

static size_t GetArgumentCount(const FunctionCallbackInfo<Value>& info) {
  return info.Length();
}

static Local<Value> GetArgument(const FunctionCallbackInfo<Value>& info, size_t index) {
  return info[index];
}

static void SetReturnValue(const FunctionCallbackInfo<Value>& info, Local<Value> value) {
  if (!value.IsEmpty()) {
    info.GetReturnValue().Set(value);
  }
}

static Memory GetMemory(Local<ArrayBuffer> buffer) {
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  Memory memory;
  memory.bytes = reinterpret_cast<int8_t *>(store->Data());
  memory.len = store->ByteLength();
  return memory;
}

static Result AllocateMemory(Isolate* isolate, Local<Array>& pool, size_t size, Memory* dest) {
  if (pool.IsEmpty()) {
    pool = Array::New(isolate);
  }
  Local<ArrayBuffer> buffer = ArrayBuffer::New(isolate, size);
  uint32_t index = pool->Length();
  pool->Set(isolate->GetCurrentContext(), index, buffer).Check();
  *dest = GetMemory(buffer);
  return Result::success;
}

static bool IsNull(Isolate* isolate, Local<Value> value) {
  return value->IsNullOrUndefined();
}

static bool IsArrayBuffer(Isolate* isolate, Local<Value> value) {
  return value->IsArrayBuffer() || value->IsArrayBufferView();
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

static Result ConvertToUTF8(Isolate* isolate, Local<Value> value, Local<Array>& pool, Memory* dest) {
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
  Memory memory;
  if (AllocateMemory(isolate, pool, (len + 1) * sizeof(uint8_t), &memory) != Result::success) {
    return Result::failure;
  }
  char *buffer = reinterpret_cast<char *>(memory.bytes);
  string->WriteUtf8(isolate, buffer);
  *dest = memory;
  return Result::success;
}

static Result ConvertToUTF16(Isolate* isolate, Local<Value> value, Local<Array>& pool, Memory* dest) {
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
  Memory memory;
  if (AllocateMemory(isolate, pool, (len + 1) * sizeof(uint16_t), &memory) != Result::success) {
    return Result::failure;
  }
  uint16_t *buffer = reinterpret_cast<uint16_t *>(memory.bytes);
  string->Write(isolate, buffer);
  *dest = memory;
  return Result::success;
}

static Result ConvertToBuffer(Isolate* isolate, Local<Value> value, Memory* dest) {
  Local<ArrayBuffer> buffer; 
  if (value->IsArrayBuffer()) {
    buffer = value.As<ArrayBuffer>();
  } else if (value->IsArrayBufferView()) {
    buffer = value.As<ArrayBufferView>()->Buffer();
  } else {
    return Result::failure;
  }
  *dest = GetMemory(buffer);
  return Result::success;
}

static void ThrowException(Isolate* isolate, const char* message) {
    Local<String> value = String::NewFromUtf8(isolate, message).ToLocalChecked();
    isolate->ThrowException(Exception::Error(value));
}

static void Run(const FunctionCallbackInfo<Value>& info) {
  void *data = info.Data().As<External>()->Value();
  const FunctionRecord *record = reinterpret_cast<FunctionRecord *>(data);
  Local<Array> pool;
  record->thunk(info, pool);
}

static MaybeLocal<Value> ProcessEntry(Isolate* isolate, const Entry* entry) {
  switch (EntryType(entry->type)) {
    case EntryType::function: {
      void *data = const_cast<FunctionRecord *>(&entry->function);
      Local<External> external = External::New(isolate, data);
      Local<Context> context = isolate->GetCurrentContext();
      return FunctionTemplate::New(isolate, Run, external, 
        Local<Signature>(), entry->function.arg_count)
          ->GetFunction(context).ToLocalChecked();
    }
    case EntryType::intValue: 
    case EntryType::enumValue: {
      return Number::New(isolate, (double) entry->int_value);
    }
    case EntryType::floatValue: {
      return Number::New(isolate, entry->float_value);
    }
    case EntryType::enumSet: {
      Local<Value> hash = Object::New(isolate);
      Local<Context> context = isolate->GetCurrentContext();
      for (size_t i = 0; i < entry->enum_set.record_count; i++) {
        const EnumRecord *record = &entry->enum_set.records[i];
        hash.As<Object>()->Set(context, 
          String::NewFromUtf8(isolate, record->name).ToLocalChecked(),
          Number::New(isolate, (double) record->value)).Check();
      }
      return hash;
    }
    case EntryType::object:
    case EntryType::unavailable:
      break;
  }
  return MaybeLocal<Value>();                                   
}

class AddonData {
 public:
  explicit AddonData(Isolate* isolate) {
    node::AddEnvironmentCleanupHook(isolate, DeleteInstance, this);
  }

  static void DeleteInstance(void* data) {
    delete static_cast<AddonData*>(data);
  }
};

static void Load(const FunctionCallbackInfo<Value>& info) {
  AddonData* data = reinterpret_cast<AddonData*>(info.Data().As<External>()->Value());
  Isolate* isolate = info.GetIsolate();

  // check arguments
  if (info.Length() < 1 || !info[0]->IsString()) {
    ThrowException(isolate, "Invalid arguments");
    return;
  }

  // load the shared library
	String::Utf8Value path(isolate, info[0]);
  void *handle = dlopen(*path, RTLD_LAZY);
  if (!handle) {
    ThrowException(isolate, "Unable to load shared library");
    return;
  }

  // find the zig module
  void *symbol = dlsym(handle, "zig_module");
  if (!symbol) {
    ThrowException(isolate, "Unable to find the symbol \"zig_module\"");
    return;
  }

  // attach callbacks to module
  ZigModule *module = reinterpret_cast<ZigModule *>(symbol);
  Callbacks *callbacks = module->callbacks;
  callbacks->get_isolate = GetIsolate;
  callbacks->get_argument_count = GetArgumentCount;
  callbacks->get_argument = GetArgument;
  callbacks->set_return_value = SetReturnValue;
  callbacks->is_null = IsNull;
  callbacks->is_array_buffer = IsArrayBuffer;
  callbacks->convert_to_bool = ConvertToBool;
  callbacks->convert_to_i32 = ConvertToI32;
  callbacks->convert_to_u32 = ConvertToU32;
  callbacks->convert_to_i64 = nullptr;
  callbacks->convert_to_u64 = nullptr;
  callbacks->convert_to_f64 = ConvertToF64;
  callbacks->convert_to_utf8 = ConvertToUTF8;
  callbacks->convert_to_utf16 = ConvertToUTF16;
  callbacks->convert_to_buffer = ConvertToBuffer;
  callbacks->convert_from_bool = ConvertFromBool;
  callbacks->convert_from_i32 = ConvertFromI32;
  callbacks->convert_from_u32 = ConvertFromU32;
  callbacks->convert_from_i64 = nullptr;
  callbacks->convert_from_u64 = nullptr;
  callbacks->convert_from_f64 = ConvertFromF64;
  callbacks->throw_exception = ThrowException;

  // process all entries inside modules
  Local<Value> hash = Object::New(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  for (size_t i = 0; i < module->entry_count; i++) {
    const Entry *entry = &module->entries[i];
    MaybeLocal<Value> result = ProcessEntry(isolate, entry);
    if (!result.IsEmpty()) {
      hash.As<Object>()->Set(context, 
        String::NewFromUtf8(isolate, entry->name).ToLocalChecked(),
        result.ToLocalChecked()).Check();
    }
  }

  // TODO: save the handle so we can release it on shutdown

  info.GetReturnValue().Set(hash);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  Isolate* isolate = context->GetIsolate();
  AddonData* data = new AddonData(isolate);
  Local<External> external = External::New(isolate, data);

  exports->Set(context,
    String::NewFromUtf8(isolate, "load").ToLocalChecked(),
    FunctionTemplate::New(isolate, Load, external)
      ->GetFunction(context).ToLocalChecked()).Check();
} 