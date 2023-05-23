#include <limits>
#include <cmath>
#include "addon.h"

//-----------------------------------------------------------------------------
//  Utility functions
//-----------------------------------------------------------------------------
static Local<String> NewString(Isolate* isolate, 
                               const char* string) {
  if (string) {
    return String::NewFromUtf8(isolate, string).ToLocalChecked();
  } else {
    return Local<String>();
  }
}

static void ThrowException(Isolate* isolate, 
                           const char* message) {
  Local<String> string = NewString(isolate, message);
  Local<Value> error = Exception::Error(string);
  isolate->ThrowException(error);
}

static ::TypedArray GetMemory(Local<ArrayBuffer> buffer) {
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  ::TypedArray array;
  array.type = NumberType::u8;
  array.bytes = reinterpret_cast<uint8_t*>(store->Data());
  array.byte_size = store->ByteLength();
  return array;
}

static size_t FindAddress(Local<ArrayBuffer> buffer, 
                          size_t address, 
                          size_t len, 
                          size_t* offset_dest) {
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  size_t buf_start = reinterpret_cast<size_t>(store->Data());
  size_t buf_end = buf_start + store->ByteLength();
  if (buf_start <= address && address + len <= buf_end) {
    *offset_dest = address - buf_start;
    return true;
  }        
  return false;
}

//-----------------------------------------------------------------------------
//  Callback functions that zig modules will invoke
//-----------------------------------------------------------------------------
static Result GetArgumentCount(Call* call,
                               size_t* dest) {
  *dest = call->node_args->Length();
  return Result::ok;
}

static Result GetArgument(Call* call, 
                          size_t index,
                          Local<Value> *dest) {
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
  *dest = value;
  return Result::ok;
}

static Result SetReturnValue(Call* call, 
                             Local<Value> value) {
  if (!value.IsEmpty()) {
    call->node_args->GetReturnValue().Set(value);
  }
  return Result::ok;
}

static Result GetSlotObject(Call* call, 
                            size_t slot_id, 
                            Local<Value> *dest) {
  Local<Array> array = Local<Array>::New(call->isolate, call->zig_func->slot_data);
  MaybeLocal<Value> value = array->Get(call->exec_context, slot_id);
  if (value.IsEmpty()) {
    return Result::failure;
  }
  return Result::ok;
}

static Result GetSlotData(Call* call, 
                          size_t slot_id, 
                          void **dest) {
  Local<Value> value;
  if (GetSlotObject(call, slot_id, &value) != Result::ok) {
    return Result::failure;
  } 
  *dest = value.As<External>()->Value();
  return Result::ok;
}

static Result SetSlotObject(Call* call, 
                            size_t slot_id, 
                            Local<Value> object) {
  Local<Array> array = Local<Array>::New(call->isolate, call->zig_func->slot_data);
  array->Set(call->exec_context, slot_id, object).Check();
  return Result::ok;  
}

static Result SetSlotData(Call* call, 
                          size_t slot_id, 
                          void *data,
                          size_t byte_size) { 
  // allocate enough memory to hold the global and the payload
  size_t total_size = sizeof(SlotData) + byte_size;
  uint8_t* bytes = new uint8_t[total_size];
  SlotData* sd = reinterpret_cast<SlotData*>(bytes);
  memset(&sd->external, 0, sizeof(Global<Value>));
  memcpy(sd->payload, data, byte_size);
  // create a v8::External and attach it to global ref
  Local<External> external = External::New(call->isolate, sd->payload);
  sd->external.Reset(call->isolate, external);
  // use SetWeak to invoke a callback when the External gets gc'ed
  sd->external.template SetWeak<SlotData>(sd, 
    [](const v8::WeakCallbackInfo<SlotData>& data) {
      SlotData* sd = data.GetParameter();
      sd->external.Reset();
      delete sd;
    }, WeakCallbackType::kParameter);
  return SetSlotObject(call, slot_id, external);

}

static Result CreateString(Call* call,
                           const char* string,
                           Local<String>* dest) {
  *dest = NewString(call->isolate, string);
  return Result::ok;
}

static Result CreateNamespace(Call* call, 
                              Local<Object> *dest) {
  Local<Value> prototype, values[0];
  Local<Name> names[0];
  *dest = Object::New(call->isolate, prototype, names, values, 0);
  return Result::ok;
}

static Result CreateFunction(Call* call, 
                             Local<String> name, 
                             size_t arg_count, 
                             Thunk thunk, 
                             Local<v8::Function>* dest) {
  // allocate a small bit of memory to hold reference to the thunk
  // and keep the slot_data array alive
  FunctionData *fd = new FunctionData;
  fd->thunk = thunk;
  fd->slot_data.Reset(call->isolate, call->zig_func->slot_data);
  // stick it into an external object, using SetWeak to invoke a callback 
  // when the external object gets gc'ed
  Local<External> external = External::New(call->isolate, fd);
  fd->external.Reset(call->isolate, external);
  fd->external.template SetWeak<FunctionData>(fd, 
    [](const v8::WeakCallbackInfo<FunctionData>& data) {
      FunctionData* fd = data.GetParameter();
      fd->external.Reset();
      delete fd;
    }, WeakCallbackType::kParameter);
  // create function template
  Local<Signature> signature;
  Local<FunctionTemplate> tmpl = FunctionTemplate::New(call->isolate,
    [](const FunctionCallbackInfo<Value>& info) {
      Call ctx(info);
      ctx.zig_func->thunk(&ctx);
    }, external, signature, arg_count);
  MaybeLocal<v8::Function> result = tmpl->GetFunction(call->exec_context);
  if (result.IsEmpty()) {
    return Result::failure;
  }
  Local<v8::Function> function = result.ToLocalChecked();
  if (!name.IsEmpty()) {
    function->SetName(name);
  }
  *dest = function;
  return Result::ok;
}

static Result SetAccessors(Call* call, 
                           Local<Object> container,
                           Local<String> name, 
                           Thunk getter_thunk,
                           Thunk setter_thunk) {
  Local<v8::Function> getter, setter;
  PropertyAttribute attribute = static_cast<PropertyAttribute>(DontDelete | ReadOnly);
  if (getter_thunk) {
    if (CreateFunction(call, Local<String>(), 0, getter_thunk, &getter) != Result::ok) {
      return Result::failure;
    }
  }
  if (setter_thunk) {
    if (CreateFunction(call, Local<String>(), 1, setter_thunk, &setter) != Result::ok) {
      return Result::failure;
    }
    attribute = static_cast<PropertyAttribute>(attribute & ~ReadOnly);   
  }
  container->SetAccessorProperty(name, getter, setter, attribute);
  return Result::ok;
}

static Result GetProperty(Call* call, 
                          Local<Object> object, 
                          Local<String> name, 
                          Local<Value>* dest) {
  MaybeLocal<Value> result = object->Get(call->exec_context, name);
  if (result.IsEmpty()) {
    return Result::failure;
  }
  *dest = result.ToLocalChecked();
  return Result::ok;
}

static Result SetProperty(Call* call, 
                          Local<Object> object, 
                          Local<String> name, 
                          Local<Value> value) {
  object->Set(call->exec_context, name, value).Check();
  return Result::ok;
}

static Result AllocateMemory(Call* call, 
                             size_t size, 
                             ::TypedArray* dest) {
  if (call->mem_pool.IsEmpty()) {
    call->mem_pool = Array::New(call->isolate);
  }
  Local<ArrayBuffer> buffer = ArrayBuffer::New(call->isolate, size);
  uint32_t index = call->mem_pool->Length();
  call->mem_pool->Set(call->exec_context, index, buffer).Check();
  *dest = GetMemory(buffer);
  return Result::ok;
}

static Result IsValueType(Local<Value> value, 
                          ValueMask mask,
                          bool* dest) {
  *dest = (mask.empty && value->IsNullOrUndefined())
       || (mask.boolean && value->IsBoolean())
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
  return Result::ok;
}

static Result UnwrapBool(Call* call, 
                         Local<Value> value, 
                         bool* dest) {
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

static Result UnwrapInt32(Call* call, 
                          Local<Value> value, 
                          int32_t* dest) {
  if (value->IsInt32()) {
    *dest = value.As<Int32>()->Value();
    return Result::ok;
  }
  return Result::failure;
}

static Result WrapInt32(Call* call, 
                        int32_t value, 
                        Local<Value>* dest) {
  *dest = Int32::New(call->isolate, value);
  return Result::ok;
}

static Result UnwrapDouble(Call* call, 
                           Local<Value> value, 
                           double* dest) {
  if (value->IsNumber()) {
    *dest = value.As<Number>()->Value();
    return Result::ok;
  }
  return Result::failure;
}

static Result WrapDouble(Call* call, 
                         double value, 
                         Local<Value>* dest) {
  *dest = Number::New(call->isolate, value);
  return Result::ok;
}

static Result UnwrapBigInt(Call* call, 
                           Local<Value> value, 
                           ::BigInt* dest) {
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

static Result WrapBigInt(Call* call, 
                         const ::BigInt& value, 
                         Local<Value>* dest) {
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

static Result UnwrapString(Call* call,
                           Local<Value> value, 
                           ::TypedArray* dest) {
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

static Result UnwrapTypedArray(Call* call, 
                               Local<Value> value, 
                               ::TypedArray* dest) {
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

static MaybeLocal<ArrayBuffer> ObtainBuffer(Call* call, 
                                            const ::TypedArray& value, 
                                            size_t *offset_dest) {
  // since the Call struct is allocated on the stack, its address is the 
  // starting point of stack space used by Zig code
  size_t stack_top = reinterpret_cast<size_t>(call) + sizeof(Call);
  size_t stack_bottom = reinterpret_cast<size_t>(&stack_top);
  size_t address = reinterpret_cast<size_t>(value.bytes);
  if (stack_bottom <= address && address + value.byte_size <= stack_top) {
    // need to copy data sitting on the stack
    Local<ArrayBuffer> buffer = ArrayBuffer::New(call->isolate, value.byte_size);
    ::TypedArray mem = GetMemory(buffer);
    memcpy(mem.bytes, value.bytes, value.byte_size);
    *offset_dest = 0;
    return buffer;
  } 
  // maybe it's pointing to a buffer passed as argument?
  int arg_count = call->node_args->Length();
  for (int i = 0; i < arg_count; i++) {
    Local<Value> arg = (*call->node_args)[i];
    Local<ArrayBuffer> buffer;
    if (arg->IsArrayBuffer()) {
      buffer = arg.As<ArrayBuffer>();
    } else if (arg->IsArrayBufferView()) {
      buffer = arg.As<ArrayBufferView>()->Buffer();
    }
    if (!buffer.IsEmpty()) {
      if (FindAddress(buffer, address, value.byte_size, offset_dest)) {
        return buffer;
      }
    }
  }
  // otherwise it's probably in the memory pool
  int buf_count = call->mem_pool->Length();
  for (int i = 0; i < buf_count; i++) {
    MaybeLocal<Value> item = call->mem_pool->Get(call->exec_context, i);
    if (!item.IsEmpty()) {
      Local<ArrayBuffer> buffer = item.ToLocalChecked().As<ArrayBuffer>();
      if (FindAddress(buffer, address, value.byte_size, offset_dest)) {
        return buffer;
      }
    }
  }  
  return MaybeLocal<ArrayBuffer>();
}

template <typename T> 
Local<Value> CreateTypedArray(Local<T> buffer, 
                              size_t offset, 
                              size_t byte_size, 
                              NumberType type) {
  switch (type) {
    case NumberType::i8:
      return Int8Array::New(buffer, offset, byte_size / sizeof(int8_t));
    case NumberType::u8:
      return Uint8Array::New(buffer, offset, byte_size / sizeof(uint8_t));
    case NumberType::i16:
      return Int16Array::New(buffer, offset, byte_size / sizeof(int16_t));
    case NumberType::u16:
      return Uint16Array::New(buffer, offset, byte_size / sizeof(uint16_t));
    case NumberType::i32:
      return Int32Array::New(buffer, offset, byte_size / sizeof(int32_t));
    case NumberType::u32:
      return Uint32Array::New(buffer, offset, byte_size / sizeof(uint32_t));
    case NumberType::i64:
      return BigInt64Array::New(buffer, offset, byte_size / sizeof(int64_t));
    case NumberType::u64:
      return BigUint64Array::New(buffer, offset, byte_size / sizeof(uint64_t));
    case NumberType::f32:
      return Float32Array::New(buffer, offset, byte_size / sizeof(float));
    case NumberType::f64:
      return Float64Array::New(buffer, offset, byte_size / sizeof(double));
    default:
      return buffer;
  }
}

static Result WrapTypedArray(Call* call,
                             const ::TypedArray& value, 
                             Local<Value>* dest) {
  size_t offset = 0;
  MaybeLocal<ArrayBuffer> known = ObtainBuffer(call, value, &offset);
  if (!known.IsEmpty()) {
    Local<ArrayBuffer> buffer = known.ToLocalChecked();
    *dest = CreateTypedArray(buffer, offset, value.byte_size, value.type);
  } else {
#ifndef V8_ENABLE_SANDBOX
    // okay, we're dealing with mystery memory here
    // assuming user knows what he's doing, we'll create a shared buffer 
    // pointing to that memory
    std::shared_ptr<BackingStore> store = SharedArrayBuffer::NewBackingStore(value.bytes, value.byte_size, [](void*, size_t, void*) {
      // do nothing when buffer gets gc'ed
    }, nullptr);
    Local<SharedArrayBuffer> shared_buf = SharedArrayBuffer::New(call->isolate, store);
    *dest = CreateTypedArray(shared_buf, offset, value.byte_size, value.type);
#else
    return Result::failure;
#endif    
  }
  return Result::ok;
}

static Result ThrowException(Call* call, 
                             const char* message) {
  Local<Value> error = Exception::Error(NewString(call->isolate, message));
  call->isolate->ThrowException(error);
  return Result::ok;
}

//-----------------------------------------------------------------------------
//  Function for loading Zig modules
//-----------------------------------------------------------------------------
int so_count = 0;

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
  callbacks->set_return_value = SetReturnValue;

  callbacks->get_slot_data = GetSlotData;
  callbacks->get_slot_object = GetSlotObject;
  callbacks->set_slot_data = SetSlotData;
  callbacks->set_slot_object = SetSlotObject;

  callbacks->create_string = CreateString;
  callbacks->create_namespace = CreateNamespace;
  callbacks->create_function = CreateFunction;
  callbacks->create_constructor = nullptr;
  callbacks->create_object = nullptr;

  callbacks->get_property = GetProperty;
  callbacks->set_property = SetProperty;
  callbacks->set_accessors = SetAccessors;

  callbacks->get_array_length = nullptr;
  callbacks->get_array_item = nullptr;
  callbacks->set_array_item = nullptr;

  callbacks->is_value_type = IsValueType;

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

  // create array for storing slot data
  Local<Array> slot_data = Array::New(isolate, 1);

  // save shared library in an external object
  ModuleData *md = new ModuleData;
  md->so_handle = handle;
  Local<External> external = External::New(isolate, md);
  md->external.Reset(isolate, external);
  md->external.template SetWeak<ModuleData>(md, 
    [](const v8::WeakCallbackInfo<ModuleData>& data) {
      ModuleData* md = data.GetParameter();
      md->external.Reset();
      // unload shared library when external object is gc'ed
      dlclose(md->so_handle);
      so_count--;
      delete md;
    }, WeakCallbackType::kParameter);
  // save external object into slot 0, which is never used
  slot_data->Set(isolate->GetCurrentContext(), 0, external).Check();

  // call the root function, which will set the return value
  Call ctx(info);
  FunctionData fds;
  fds.slot_data.Reset(isolate, slot_data);
  fds.thunk = module->root;
  ctx.zig_func = &fds;
  module->root(&ctx);
}

static void GetLibraryCount(const FunctionCallbackInfo<Value>& info) {
  info.GetReturnValue().Set(so_count);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  Isolate* isolate = context->GetIsolate();
  auto add = [&](const char *name, void (*f)(const FunctionCallbackInfo<Value>& info)) {
    Local<Signature> signature;
    Local<Value> data;
    Local<FunctionTemplate> tmpl = FunctionTemplate::New(isolate, f, data, signature, 1);
    Local<v8::Function> function = tmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
    Local<String> n = NewString(isolate, name);
    exports->Set(context, n, function).Check();
  };
  add("load", Load);
  add("getLibraryCount", GetLibraryCount);
} 
