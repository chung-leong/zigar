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

//-----------------------------------------------------------------------------
//  Callback functions that zig modules will invoke
//-----------------------------------------------------------------------------
static Result GetSlot(Host* call, 
                      size_t slot_id, 
                      Local<Value> *dest) {
  Local<Object> slots = Local<Object>::New(call->isolate, call->zig_func->slot_data);
  MaybeLocal<Value> result = slots->Get(call->exec_context, slot_id);
  if (result.IsEmpty()) {
    return Result::Failure;
  }  
  *dest = result.ToLocalChecked();
  return Result::OK;
}

static Result SetSlot(Host* call, 
                      size_t slot_id, 
                      Local<Value> object) {
  Local<Object> slots = Local<Object>::New(call->isolate, call->zig_func->slot_data);
  slots->Set(call->exec_context, slot_id, object).Check();
  return Result::OK;  
}

static Result AllocateMemory(Host* call, 
                             size_t size, 
                             uint8_t **dest) {
  if (call->mem_pool.IsEmpty()) {
    call->mem_pool = Array::New(call->isolate);
  }
  Local<ArrayBuffer> buffer = ArrayBuffer::New(call->isolate, size);
  uint32_t index = call->mem_pool->Length();
  call->mem_pool->Set(call->exec_context, index, buffer).Check();

  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  *dest = reinterpret_cast<uint8_t *>(store->Data());
  return Result::OK;
}

static MaybeLocal<Value> CompileJavaScript(Isolate* isolate) {
  const char *code = 
    #include "addon.js.txt"
  ;
  Local<Context> context = isolate->GetCurrentContext();
  Local<String> source = NewString(isolate, code);  
  MaybeLocal<Script> result = Script::Compile(context, source);
  if (result.IsEmpty()) {
    return MaybeLocal<Value>();
  }
  Local<Script> script = result.ToLocalChecked();
  return script->Run(context);
}

//-----------------------------------------------------------------------------
//  Function for loading Zig modules
//-----------------------------------------------------------------------------
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
    return;
  }

  // attach callbacks to module
  ::Module* module = reinterpret_cast<::Module*>(symbol);
  Callbacks* callbacks = module->callbacks;
  callbacks->allocate_memory = AllocateMemory;
  callbacks->get_slot = GetSlot;
  callbacks->set_slot = SetSlot;
  callbacks->begin_structure = nullptr;
  callbacks->add_member = nullptr;
  callbacks->finalize_structure = nullptr;

  printf("Creating slots\n");

  // create object for storing slot data
  Local<Object> slot_data = Object::New(isolate);

  // place shared library handle in an external object and keep it in slot 0
  ModuleData *md = new ModuleData(isolate, handle);
  slot_data->Set(isolate->GetCurrentContext(), 0, Local<External>::New(isolate, md->external)).Check();

  printf("Module data\n");

  // call the factory function
  Host ctx(info);
  auto fd = new FunctionData(isolate, nullptr, slot_data);
  ctx.zig_func = fd;
  Local<Value> ns;
  if (module->factory(&ctx, &ns) == Result::OK) {
    info.GetReturnValue().Set(ns);
  } else {
    ThrowException(isolate, "Unable to create namespace");
  }
}

static void GetLibraryCount(const FunctionCallbackInfo<Value>& info) {
  info.GetReturnValue().Set(ModuleData::count);
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

int ModuleData::count = 0;