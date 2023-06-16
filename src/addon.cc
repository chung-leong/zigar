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

static Result CreateStructure(Host* call,
                              StructureType type,
                              const char* name,
                              Local<Object>* dest) {
  auto jsb = call->js_bridge;
  auto f = jsb->create_structure;
  Local<Value> args[2] = {
    Uint32::NewFromUnsigned(jsb->isolate, static_cast<uint32_t>(type)),
    String::NewFromUtf8(jsb->isolate, name).ToLocalChecked(),
  };
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

static Result ShapeStructure(Host* call,
                             Local<Object> structure,
                             const MemberSet& member_set) {
  printf("Shaping structure...\n");
  auto jsb = call->js_bridge;
  auto f = jsb->shape_structure;
  auto array = Array::New(jsb->isolate, member_set.member_count);
  printf("Members: %zx %zu\n", reinterpret_cast<size_t>(member_set.members), member_set.member_count);
  for (size_t i = 0; i < member_set.member_count; i++) {
    array->Set(jsb->context, i, jsb->NewMemberRecord(member_set.members[i])).Check();
  }
  Local<Object> default_data;
  Local<Object> default_pointers;
  auto def = jsb->NewMemberSet(member_set.total_size, array, default_data, default_pointers);
  Local<Value> args[3] = { structure, def, jsb->options };
  if (f->Call(jsb->context, Null(jsb->isolate), 3, args).IsEmpty()) {
    return Result::Failure;
  }
  printf("Done\n");
  return Result::OK;
}

static Result AttachVariables(Host* call,
                              Local<Object> structure,
                              const MemberSet& member_set) {
  printf("Attach variables...\n");
  auto jsb = call->js_bridge;
  auto f = jsb->attach_variables;
  auto array = Array::New(jsb->isolate, member_set.member_count);
  printf("Members: %zu\n", member_set.member_count);
  for (size_t i = 0; i < member_set.member_count; i++) {
    array->Set(jsb->context, i, jsb->NewMemberRecord(member_set.members[i])).Check();
  }
  Local<Object> default_data;
  Local<Object> default_pointers;
  auto def = jsb->NewMemberSet(member_set.total_size, array, default_data, default_pointers);
  Local<Value> args[3] = { structure, def, jsb->options };
  if (f->Call(jsb->context, Null(jsb->isolate), 3, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachMethods(Host* call,
                            Local<Object> structure,
                            const MethodSet& method_set) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_methods;
  auto array = Array::New(jsb->isolate, method_set.method_count);
  for (size_t i = 0; i < method_set.method_count; i++) {
    array->Set(jsb->context, i, jsb->NewMethodRecord(method_set.methods[i])).Check();
  }
  auto def = jsb->NewMethodSet(array);
  Local<Value> args[3] = { structure, def, jsb->options };
  if (f->Call(call->exec_context, Null(jsb->isolate), 3, args).IsEmpty()) {
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
    printf("Factory is done!\n");
    info.GetReturnValue().Set(ns);
  } else {
    printf("Factory failed!\n");
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