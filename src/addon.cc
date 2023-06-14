#include "addon.h"

//-----------------------------------------------------------------------------
//  Callback functions that zig modules will invoke
//-----------------------------------------------------------------------------
static Result GetSlot(Host* call, 
                      size_t slot_id, 
                      Local<Value> *dest) {
  if (call->slots.IsEmpty()) {
    call->slots = Local<Object>::New(call->isolate, call->zig_func->slots);
  }
  MaybeLocal<Value> result = call->slots->Get(call->exec_context, slot_id);
  if (result.IsEmpty()) {
    return Result::Failure;
  }  
  *dest = result.ToLocalChecked();
  return Result::OK;
}

static Result SetSlot(Host* call, 
                      size_t slot_id, 
                      Local<Value> object) {
  if (call->slots.IsEmpty()) {
    call->slots = Local<Object>::New(call->isolate, call->zig_func->slots);
  }
  call->slots->Set(call->exec_context, slot_id, object).Check();
  return Result::OK;  
}

static Result AllocateMemory(Host* call, 
                             size_t size, 
                             Memory* dest) {
  if (call->mem_pool.IsEmpty()) {
    call->mem_pool = Array::New(call->isolate);
  }
  Local<ArrayBuffer> buffer = ArrayBuffer::New(call->isolate, size);
  uint32_t index = call->mem_pool->Length();
  call->mem_pool->Set(call->exec_context, index, buffer).Check();
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  dest->bytes = reinterpret_cast<uint8_t *>(store->Data());
  dest->len = store->ByteLength();
  return Result::OK;
}

static Result CreateStructure(Host* call,
                              StructureType type,
                              const char* name,
                              Local<Object>* dest) {
  JSBridge *jsb = call->js_bridge;
  Local<Function> f = jsb->create_structure;
  Local<Value> recv;
  Local<Value> args[2] = {
    Uint32::NewFromUnsigned(call->isolate, static_cast<uint32_t>(type)),
    String::NewFromUtf8(call->isolate, name).ToLocalChecked(),
  };
  MaybeLocal<Value> result = f->CallAsFunction(call->exec_context, recv, 2, args); 
  Local<Value> value;
  if (!result.ToLocal<Value>(&value) || !value->IsObject()) {
    return Result::Failure;
  }
  *dest = value.As<Object>();
  return Result::OK;
}

static Result ShapeStructure(Host* call,
                             Local<Object> structure,
                             const MemberSet* ms) {
  JSBridge *jsb = call->js_bridge;
  Local<Function> f = jsb->shape_structure;
  Local<Array> array = Array::New(call->isolate, ms->member_count);
  for (size_t i = 0; i < ms->member_count; i++) {
    array->Set(jsb->context, i, jsb->NewMemberRecord(ms->members[i])).Check();
  }
  Local<Object> def = Object::New(call->isolate);
  def->Set(call->exec_context, jsb->n_size, Uint32::NewFromUnsigned(call->isolate, ms->member_count)).Check();
  def->Set(call->exec_context, jsb->n_members, array).Check();
  Local<Value> recv;
  Local<Value> args[3] = { structure, def, jsb->options };
  MaybeLocal<Value> result = f->CallAsFunction(call->exec_context, recv, 3, args);
  if (result.IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachVariables(Host* call,
                              Local<Object> structure,
                              const MemberSet* ms) {
  JSBridge *jsb = call->js_bridge;
  Local<Function> f = jsb->attach_variables;
  Local<Array> array = Array::New(call->isolate, ms->member_count);
  for (size_t i = 0; i < ms->member_count; i++) {
    array->Set(jsb->context, i, jsb->NewMemberRecord(ms->members[i])).Check();
  }
  Local<Object> def = Object::New(call->isolate);
  Local<Value> recv;
  Local<Value> args[3] = { structure, def, jsb->options };
  MaybeLocal<Value> result = f->CallAsFunction(call->exec_context, recv, 3, args);
  if (result.IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachMethods(Host* call,
                            Local<Object> structure,
                            const MethodSet* ms) {
  JSBridge *jsb = call->js_bridge;
  Local<Function> f = jsb->attach_methods;
  Local<Array> array = Array::New(call->isolate, ms->method_count);
  for (size_t i = 0; i < ms->method_count; i++) {
    array->Set(jsb->context, i, jsb->NewMethodRecord(ms->methods[i])).Check();
  }
  Local<Value> recv;
  Local<Value> args[3] = { structure, array, jsb->options };
  MaybeLocal<Value> result = f->CallAsFunction(call->exec_context, recv, 3, args);
  if (result.IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

//-----------------------------------------------------------------------------
//  Function for loading Zig modules
//-----------------------------------------------------------------------------
static void Load(const FunctionCallbackInfo<Value>& info) {
  Isolate* isolate = info.GetIsolate();
  AddonData* ad = reinterpret_cast<AddonData*>(info.Data().As<External>()->Value());

  auto Throw = [&](const char *message) {
    Local<String> string;
    if (String::NewFromUtf8(isolate, message).ToLocal<String>(&string)) {
      Local<Value> error = Exception::Error(string);
      isolate->ThrowException(error);
    }
  };

  // check arguments
  if (info.Length() < 1 || !info[0]->IsString()) {
    Throw("Invalid arguments");
    return;
  }

  // load the shared library
	String::Utf8Value path(isolate, info[0]);
  void* handle = dlopen(*path, RTLD_LAZY);
  if (!handle) {
    Throw("Unable to load shared library");
    return;
  }

  // find the zig module
  void* symbol = dlsym(handle, "zig_module");
  if (!symbol) {
    Throw("Unable to find the symbol \"zig_module\"");
    return;
  }

  // compile JavaScript code if it hasn't happened already
  Local<Object> js_module;
  if (!ad->js_module.IsEmpty()) {
    const char *code = 
      #include "addon.js.txt"
    ;
    Local<Context> context = isolate->GetCurrentContext();
    Local<String> source = String::NewFromUtf8(isolate, code).ToLocalChecked();  
    MaybeLocal<Script> compile_result = Script::Compile(context, source);
    if (compile_result.IsEmpty()) {
      Throw("Unable to compile JavaScript code");
      return;
    }
    Local<Script> script = compile_result.ToLocalChecked();
    MaybeLocal<Value> run_result = script->Run(context);
    if (run_result.IsEmpty()) {
      Throw("Failed to obtain result from JavaScript code");
      return;
    }
    js_module = run_result.ToLocalChecked().As<Object>();
    ad->js_module.Reset(isolate, js_module);
  } else {
    js_module = Local<Object>::New(isolate, ad->js_module);
  }

  // attach callbacks to module
  ::Module* module = reinterpret_cast<::Module*>(symbol);
  Callbacks* callbacks = module->callbacks;
  callbacks->allocate_memory = AllocateMemory;
  callbacks->get_slot = GetSlot;
  callbacks->set_slot = SetSlot;
  callbacks->create_structure = CreateStructure;
  callbacks->shape_structure = ShapeStructure;
  callbacks->attach_variables = AttachVariables;
  callbacks->attach_methods = AttachMethods;

  // save handle to external object
  ModuleData *md = new ModuleData(isolate, handle);

  // call the factory function
  Host ctx(info);
  auto fd = new FunctionData(isolate, nullptr, Local<External>::New(isolate, md->external));
  ctx.zig_func = fd;
  ctx.js_bridge = new JSBridge(isolate, js_module, module->flags);
  Local<Value> ns;
  if (module->factory(&ctx, &ns) == Result::OK) {
    info.GetReturnValue().Set(ns);
  } else {
    Throw("Unable to import functions");
  }
}

static void GetLibraryCount(const FunctionCallbackInfo<Value>& info) {
  info.GetReturnValue().Set(ModuleData::count);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  Isolate* isolate = context->GetIsolate();
  auto ad = new AddonData(isolate);
  auto add = [&](Local<String> name, void (*f)(const FunctionCallbackInfo<Value>& info)) {
    Local<Signature> signature;
    Local<Value> data = Local<External>::New(isolate, ad->external);
    Local<FunctionTemplate> tmpl = FunctionTemplate::New(isolate, f, data, signature, 1);
    Local<Function> function = tmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
    exports->Set(context, name, function).Check();
  };
  add(String::NewFromUtf8Literal(isolate, "load"), Load);
  add(String::NewFromUtf8Literal(isolate, "getLibraryCount"), GetLibraryCount);
} 

int ModuleData::count = 0;