#include <node.h>
#include <dlfcn.h>

using namespace v8;

enum class Result {
  success = 0,
  failure = 1,
};

static size_t GetArgumentCount(const FunctionCallbackInfo<Value>& info) {
  return info.Length();
}

static Local<Value> GetArgument(const FunctionCallbackInfo<Value>& info, size_t index) {
  return info[index];
}

static bool IsNull(const FunctionCallbackInfo<Value>& info, Local<Value> value) {
  return value->IsNullOrUndefined();
}

static bool IsArrayBuffer(const FunctionCallbackInfo<Value>& info, Local<Value> value) {
  return value->IsArrayBuffer() || value->IsArrayBufferView();
}

static Result ConvertToBoolean(const FunctionCallbackInfo<Value>& info, Local<Value> value, bool *dest) {
  Local<Boolean> boolean;
  if (value->IsBoolean()) {
    boolean = value.As<Boolean>();
  } else {
    Isolate* isolate = info.GetIsolate();
    MaybeLocal<Boolean> result = value->ToBoolean(isolate);
    if (result.IsEmpty()) {
      return Result::failure;
    }
    boolean = result.ToLocalChecked();
  }
  *dest = boolean->Value();
  return Result::success;
}

static Result ConvertToI32(const FunctionCallbackInfo<Value>& info, Local<Value> value, int32_t *dest) {
  Local<Int32> number;
  if (value->IsInt32()) {
    number = value.As<Int32>();
  } else {
    Isolate* isolate = info.GetIsolate();
    MaybeLocal<Int32> result = value->ToInt32(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    number = result.ToLocalChecked();
  }
  *dest = number->Value();
  return Result::success;
}

static Result ConvertToU32(const FunctionCallbackInfo<Value>& info, Local<Value> value, uint32_t *dest) {
  Local<Uint32> number;
  if (value->IsUint32()) {
    number = value.As<Uint32>();
  } else {
    Isolate* isolate = info.GetIsolate();
    MaybeLocal<Uint32> result = value->ToUint32(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    number = result.ToLocalChecked();
  }
  *dest = number->Value();
  return Result::success;
}

static Result ConvertToF64(const FunctionCallbackInfo<Value>& info, Local<Value> value, double *dest) {
  Local<Number> number;
  if (value->IsNumber()) {
    number = value.As<Number>();
  } else {
    Isolate* isolate = info.GetIsolate();
    MaybeLocal<Number> result = value->ToNumber(isolate->GetCurrentContext());
    if (result.IsEmpty()) {
      return Result::failure;
    }
    number = result.ToLocalChecked();
  }
  *dest = number->Value();
  return Result::success;
}

static Result ConvertToUTF8(const FunctionCallbackInfo<Value>& info, Local<Value> value, uint8_t **dest, size_t *dest_len) {
  Local<String> string;
  Isolate* isolate = info.GetIsolate();
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
  // TODO: manage memory properly
  uint8_t *buffer = static_cast<uint8_t *>(malloc((len + 1) * sizeof(uint8_t)));
  if (!buffer) {
    return Result::failure;
  }
  string->WriteUtf8(isolate, reinterpret_cast<char *>(buffer));
  *dest = buffer;
  *dest_len = len;
  return Result::success;
}

static Result ConvertToUTF16(const FunctionCallbackInfo<Value>& info, Local<Value> value, uint16_t **dest, size_t *dest_len) {
  Local<String> string;
  Isolate* isolate = info.GetIsolate();
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
  uint16_t *buffer = static_cast<uint16_t *>(malloc((len + 1) * sizeof(uint16_t)));
  if (!buffer) {
    return Result::failure;
  }
  string->Write(isolate, buffer);
  *dest = buffer;
  *dest_len = len;
  return Result::success;
}

static Result ConvertToBuffer(const FunctionCallbackInfo<Value>& info, Local<Value> value, uint8_t **dest, size_t *dest_len) {
  Local<ArrayBuffer> buffer; 
  if (value->IsArrayBuffer()) {
    buffer = value.As<ArrayBuffer>();
  } else if (value->IsArrayBufferView()) {
    buffer = value.As<ArrayBufferView>()->Buffer();
  } else {
    return Result::failure;
  }
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  *dest = static_cast<uint8_t *>(store->Data());
  *dest_len = store->ByteLength();
  return Result::success;
}

static void ThrowException(const FunctionCallbackInfo<Value>& info, const char *message) {
    Isolate *isolate = info.GetIsolate();
    Local<String> value = String::NewFromUtf8(isolate, message).ToLocalChecked();
    isolate->ThrowException(Exception::Error(value));
}

struct Callbacks {  
  size_t (*const get_argument_count)(const FunctionCallbackInfo<Value>&);
  Local<Value> (*const get_argument)(const FunctionCallbackInfo<Value>&, size_t);
  
  bool (*const is_null)(const FunctionCallbackInfo<Value>&, Local<Value>);
  bool (*const is_array_buffer)(const FunctionCallbackInfo<Value>&, Local<Value>);

  Result (*const convert_to_boolean)(const FunctionCallbackInfo<Value>&, Local<Value>, bool *);
  Result (*const convert_to_i32)(const FunctionCallbackInfo<Value>&, Local<Value>, int32_t *);
  Result (*const convert_to_u32)(const FunctionCallbackInfo<Value>&, Local<Value>, uint32_t *);
  Result (*const convert_to_i64)(const FunctionCallbackInfo<Value>&, Local<Value>, int64_t *);
  Result (*const convert_to_u64)(const FunctionCallbackInfo<Value>&, Local<Value>, uint64_t *);
  Result (*const convert_to_f64)(const FunctionCallbackInfo<Value>&, Local<Value>, double *);
  Result (*const convert_to_utf8)(const FunctionCallbackInfo<Value>&, Local<Value>, uint8_t **, size_t *);
  Result (*const convert_to_utf16)(const FunctionCallbackInfo<Value>&, Local<Value>, uint16_t **, size_t *);
  Result (*const convert_to_buffer)(const FunctionCallbackInfo<Value>&, Local<Value>, uint8_t **, size_t *);

  void (*throw_exception)(const FunctionCallbackInfo<Value>&, const char *);

  Callbacks() :
    get_argument_count(GetArgumentCount),
    get_argument(GetArgument),
    is_null(IsNull),
    is_array_buffer(IsArrayBuffer),
    convert_to_boolean(ConvertToBoolean),
    convert_to_i32(ConvertToI32),
    convert_to_u32(ConvertToU32),
    convert_to_i64(nullptr),
    convert_to_u64(nullptr),
    convert_to_f64(ConvertToF64),
    convert_to_utf8(ConvertToUTF8),
    convert_to_utf16(ConvertToUTF16),
    convert_to_buffer(ConvertToBuffer),
    throw_exception(ThrowException) {}
};

const Callbacks callbacks;

struct FunctionRecord {
  size_t arg_count;
  void (*thunk)(const FunctionCallbackInfo<Value>&, const Callbacks &);
};

struct EnumRecord {
  const char *name;
  int value;
};

struct EnumSet {
  const EnumRecord *records;
  size_t record_count;
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
  const Entry *entries;
  size_t entry_count;
};

static void Run(const FunctionCallbackInfo<Value>& info) {
  const FunctionRecord *record = reinterpret_cast<FunctionRecord *>(info.Data().As<External>()->Value());
  record->thunk(info, callbacks);
}

static MaybeLocal<Value> ProcessEntry(Isolate *isolate, const Entry *entry) {
  switch (EntryType(entry->type)) {
    case EntryType::function: {
      Local<External> external = External::New(isolate, const_cast<FunctionRecord *>(&entry->function));
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
    ThrowException(info, "Invalid arguments");
    return;
  }

  // load the shared library
	String::Utf8Value path(isolate, info[0]);
  void *handle = dlopen(*path, RTLD_LAZY);
  if (!handle) {
    ThrowException(info, "Unable to load shared library");
    return;
  }

  // find the zig module
  void *symbol = dlsym(handle, "zig_module");
  if (!symbol) {
    ThrowException(info, "Unable to find the symbol \"zig_module\"");
    return;
  }

  // process all entries inside modules
  ZigModule *module = reinterpret_cast<ZigModule *>(symbol);
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