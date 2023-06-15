#include "addon.h"

//-----------------------------------------------------------------------------
//  Callback functions that zig modules will invoke
//-----------------------------------------------------------------------------
static Result ReadSlot(Host* call, 
                       uint32_t slot_id, 
                       Local<Value> *dest) {
  if (call->slots.IsEmpty()) {
    call->slots = Local<Object>::New(call->isolate, call->zig_func->slots);
  }
  auto result = call->slots->Get(call->exec_context, slot_id);
  if (result.IsEmpty()) {
    return Result::Failure;
  }  
  *dest = result.ToLocalChecked();
  return Result::OK;
}

static Result WriteSlot(Host* call, 
                        uint32_t slot_id, 
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
  auto buffer = ArrayBuffer::New(call->isolate, size);
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
  auto jsb = call->js_bridge;
  auto f = jsb->create_structure;
  Local<Value> recv;
  Local<Value> args[2] = {
    Uint32::NewFromUnsigned(call->isolate, static_cast<uint32_t>(type)),
    String::NewFromUtf8(call->isolate, name).ToLocalChecked(),
  };
  Local<Value> value;
  if (!f->CallAsFunction(call->exec_context, recv, 2, args).ToLocal<Value>(&value)) {
    return Result::Failure;
  }
  if (!value->IsObject()) {
    return Result::Failure;
  }
  *dest = value.As<Object>();
  return Result::OK;
}

static Result ShapeStructure(Host* call,
                             Local<Object> structure,
                             const MemberSet* ms) {
  auto jsb = call->js_bridge;
  auto f = jsb->shape_structure;
  auto array = Array::New(call->isolate, ms->member_count);
  for (size_t i = 0; i < ms->member_count; i++) {
    array->Set(jsb->context, i, jsb->NewMemberRecord(ms->members[i])).Check();
  }
  auto def = Object::New(call->isolate);
  def->Set(call->exec_context, jsb->n_size, Uint32::NewFromUnsigned(call->isolate, ms->member_count)).Check();
  def->Set(call->exec_context, jsb->n_members, array).Check();
  Local<Value> recv;
  Local<Value> args[3] = { structure, def, jsb->options };
  if (f->CallAsFunction(call->exec_context, recv, 3, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachVariables(Host* call,
                              Local<Object> structure,
                              const MemberSet* ms) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_variables;
  auto array = Array::New(call->isolate, ms->member_count);
  for (size_t i = 0; i < ms->member_count; i++) {
    array->Set(jsb->context, i, jsb->NewMemberRecord(ms->members[i])).Check();
  }
  auto def = Object::New(call->isolate);
  Local<Value> recv;
  Local<Value> args[3] = { structure, def, jsb->options };
  if (f->CallAsFunction(call->exec_context, recv, 3, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachMethods(Host* call,
                            Local<Object> structure,
                            const MethodSet* ms) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_methods;
  auto array = Array::New(call->isolate, ms->method_count);
  for (size_t i = 0; i < ms->method_count; i++) {
    array->Set(jsb->context, i, jsb->NewMethodRecord(ms->methods[i])).Check();
  }
  Local<Value> recv;
  Local<Value> args[3] = { structure, array, jsb->options };
  if (f->CallAsFunction(call->exec_context, recv, 3, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

//-----------------------------------------------------------------------------
//  Function for loading Zig modules
//-----------------------------------------------------------------------------
static void Load(const FunctionCallbackInfo<Value>& info) {
  auto isolate = info.GetIsolate();
  auto ad = reinterpret_cast<AddonData*>(info.Data().As<External>()->Value());

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
    auto context = isolate->GetCurrentContext();
    auto source = String::NewFromUtf8(isolate, code).ToLocalChecked();  
    Local<Script> script;
    if (!Script::Compile(context, source).ToLocal(&script)) {
      Throw("Unable to compile JavaScript code");
      return;
    }
    Local<Value> result;
    if (!script->Run(context).ToLocal(&result) || !result->IsObject()) {
      Throw("Failed to obtain result from JavaScript code");
      return;
    }
    js_module = result.As<Object>();
    ad->js_module.Reset(isolate, js_module);
  } else {
    js_module = Local<Object>::New(isolate, ad->js_module);
  }

  // attach callbacks to module
  auto module = reinterpret_cast<::Module*>(symbol);
  auto callbacks = module->callbacks;
  callbacks->allocate_memory = AllocateMemory;
  callbacks->read_slot = ReadSlot;
  callbacks->write_slot = WriteSlot;
  callbacks->create_structure = CreateStructure;
  callbacks->shape_structure = ShapeStructure;
  callbacks->attach_variables = AttachVariables;
  callbacks->attach_methods = AttachMethods;

  // save handle to external object
  auto md = new ModuleData(isolate, handle);

  // call the factory function
  Host ctx(info);
  auto mde = Local<External>::New(isolate, md->external);
  auto fd = new FunctionData(isolate, nullptr, mde);
  ctx.zig_func = fd;
  ctx.js_bridge = new JSBridge(isolate, js_module, mde, module->flags);
  Local<Value> ns;
  if (module->factory(&ctx, &ns) == Result::OK) {
    info.GetReturnValue().Set(ns);
  } else {
    Throw("Unable to import functions");
  }
}

static void GetModuleCount(const FunctionCallbackInfo<Value>& info) {
  info.GetReturnValue().Set(ModuleData::count);
}

static void GetFunctionCount(const FunctionCallbackInfo<Value>& info) {
  info.GetReturnValue().Set(FunctionData::count);
}

NODE_MODULE_INIT(/* exports, module, context */) {
  auto isolate = context->GetIsolate();
  auto ad = new AddonData(isolate);
  auto add = [&](Local<String> name, void (*f)(const FunctionCallbackInfo<Value>& info), int length) {    
    auto data = Local<External>::New(isolate, ad->external);
    auto tmpl = FunctionTemplate::New(isolate, f, data, Local<Signature>(), length);
    auto function = tmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
    exports->Set(context, name, function).Check();
  };
  add(String::NewFromUtf8Literal(isolate, "load"), Load, 1);
  add(String::NewFromUtf8Literal(isolate, "getModuleCount"), GetModuleCount, 0);
  add(String::NewFromUtf8Literal(isolate, "getFunctionCount"), GetModuleCount, 0);
} 

int ModuleData::count = 0;
int FunctionData::count = 0;