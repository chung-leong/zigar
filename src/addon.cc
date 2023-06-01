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

static ::TypedArray GetMemory(Local<ArrayBuffer> buffer, size_t offset = 0) {
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  ::TypedArray array;
  array.type = NumberType::u8;
  array.bytes = reinterpret_cast<uint8_t*>(store->Data()) + offset;
  array.byte_size = store->ByteLength() - offset;
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
static Result GetSlot(Host* call, 
                      size_t slot_id, 
                      Local<Value> *dest) {
  Local<Array> array = Local<Array>::New(call->isolate, call->zig_func->slot_data);
  MaybeLocal<Value> result = array->Get(call->exec_context, slot_id);
  if (result.IsEmpty()) {
    return Result::failure;
  }  
  *dest = result.ToLocalChecked();
  return Result::ok;
}

static Result SetSlot(Host* call, 
                      size_t slot_id, 
                      Local<Value> object) {
  Local<Array> array = Local<Array>::New(call->isolate, call->zig_func->slot_data);
  array->Set(call->exec_context, slot_id, object).Check();
  return Result::ok;  
}

static Result AllocateMemory(Host* call, 
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

static MaybeLocal<Value> CompileJavaScript(Isolate* isolate) {
  const char *code = 
    #include "addon.js.txt"
  ;
  ScriptCompiler::Source source(NewString(isolate, code));
  MaybeLocal<v8::Module> result = ScriptCompiler::CompileModule(isolate, &source);
  if (result.IsEmpty()) {
    return MaybeLocal<Value>();
  }
  Local<v8::Module> module = result.ToLocalChecked();
  return module->Evaluate(isolate->GetCurrentContext());
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

  // compile JavaScript code
  MaybeLocal<Value> comp_result = CompileJavaScript(isolate);
  if (comp_result.IsEmpty()) {
    ThrowException(isolate, "Unable to compile JavaScript code");
  }

  // attach callbacks to module
  ::Module* module = reinterpret_cast<::Module*>(symbol);
  Callbacks* callbacks = module->callbacks;
  callbacks->get_slot = GetSlot;
  callbacks->set_slot = SetSlot;

  callbacks->begin_structure = nullptr;
  callbacks->add_member = nullptr;
  callbacks->finalize_structure = nullptr;

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

  // call the factory function
  Host ctx(info);
  FunctionData fds;
  fds.slot_data.Reset(isolate, slot_data);
  fds.thunk = nullptr;
  ctx.zig_func = &fds;
  Local<Value> ns;
  if (module->factory(&ctx, &ns) == Result::ok) {
    info.GetReturnValue().Set(ns);
  } else {
    ThrowException(isolate, "Unable to create namespace");
  }
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
