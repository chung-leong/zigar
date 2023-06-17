#include "addon.h"

static Result ReadSlot(Host* call, 
                       uint32_t slot_id, 
                       Local<Value> *dest) {
  if (!call->slots.IsEmpty()) {
    Local<Value> value;
    if (call->slots->Get(call->exec_context, slot_id).ToLocal(&value)) {
      if (!value->IsNullOrUndefined()) {
        *dest = value;
        return Result::OK;
      }
    }  
  }
  return Result::Failure;
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

static Result BeginStructure(Host* call,
                             const Structure& structure,
                             Local<Object>* dest) {
  auto jsb = call->js_bridge;
  auto f = jsb->begin_structure;
  auto def = jsb->NewStructure(structure);
  Local<Value> args[2] = { def, jsb->options };
  Local<Value> value;
  if (!f->Call(jsb->context, Null(jsb->isolate), 2, args).ToLocal<Value>(&value)) {
    return Result::Failure;
  }
  if (!value->IsObject()) {
    return Result::Failure;
  }
  *dest = value.As<Object>();
  return Result::OK;
}

static Result AttachMember(Host* call,
                           Local<Object> structure,
                           const Member& member) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_member;
  auto def = jsb->NewMember(member);
  Local<Value> args[2] = { structure, def };
  if (f->Call(jsb->context, Null(jsb->isolate), 2, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachMethod(Host* call,
                           Local<Object> structure,
                           const Method& method) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_method;
  auto def = jsb->NewMethod(method);
  Local<Value> args[2] = { structure, def };
  if (f->Call(call->exec_context, Null(jsb->isolate), 2, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachDefaultValues(Host* call,
                                  Local<Object> structure,
                                  const DefaultValues& values) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_method;
  Local<Value> data = Null(jsb->isolate);
  Local<Value> pointers = Null(jsb->isolate);
  auto def = jsb->NewDefaultValues(values.is_static, data, pointers);
  Local<Value> args[2] = { structure, def };
  if (f->Call(call->exec_context, Null(jsb->isolate), 2, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result FinalizeStructure(Host* call,
                                Local<Object> structure) {
  auto jsb = call->js_bridge;
  auto f = jsb->finalize_structure;
  Local<Value> args[1] = { structure };
  if (f->Call(call->exec_context, Null(jsb->isolate), 1, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static void Call(const FunctionCallbackInfo<Value>& info) {
  Host ctx(info);
  ctx.zig_func->thunk(&ctx, info[0]);
}

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
  if (ad->js_module.IsEmpty()) {
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
  callbacks->begin_structure = BeginStructure;
  callbacks->attach_member = AttachMember;
  callbacks->attach_method = AttachMethod;
  callbacks->attach_default_values = AttachDefaultValues;
  callbacks->finalize_structure = FinalizeStructure;

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
  add(String::NewFromUtf8Literal(isolate, "getFunctionCount"), GetFunctionCount, 0);
} 

int ModuleData::count = 0;
int FunctionData::count = 0;