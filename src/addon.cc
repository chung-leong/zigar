#include "addon.h"

static Result ReadSlot(Host* call, 
                       uint32_t slot_id, 
                       Local<Value> *dest) {
  if (!call->slots.IsEmpty()) {
    Local<Value> value;
    if (call->slots->Get(call->context, slot_id).ToLocal(&value)) {
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
  call->slots->Set(call->context, slot_id, object).Check();
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
  call->mem_pool->Set(call->context, index, buffer).Check();
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  dest->bytes = reinterpret_cast<uint8_t *>(store->Data());
  dest->len = store->ByteLength();
  return Result::OK;
}

static Result GetMemory(Host* call,
                        Local<Object> object,
                        Memory* dest) {
  Local<Value> value;  
  if (!object->Get(call->context, call->data_symbol).ToLocal(&value) || !value->IsDataView()) {
    return Result::Failure;
  }
  auto buffer = value.As<DataView>()->Buffer();
  auto content = buffer->GetBackingStore();
  dest->bytes = reinterpret_cast<uint8_t*>(content->Data());
  dest->len = content->ByteLength();
  return Result::OK;
}

static Result CreateSharedBuffer(Host* call,
                                 const Memory& memory,
                                 Local<SharedArrayBuffer>* dest) {
  // create a reference to the module so that the shared library doesn't get unloaded
  // while the shared buffer is still around pointing to it
  auto mde = Local<External>::New(call->isolate, call->zig_func->module_data);
  auto emd = new ExternalMemoryData(call->isolate, mde);
  std::shared_ptr<BackingStore> store = SharedArrayBuffer::NewBackingStore(memory.bytes, memory.len, 
    [](void*, size_t, void* deleter_data) {
      // get rid of the reference
      auto emd = reinterpret_cast<ExternalMemoryData*>(deleter_data);
      delete emd;
    }, emd); 
  *dest = SharedArrayBuffer::New(call->isolate, store);
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
  if (f->Call(jsb->context, Null(jsb->isolate), 2, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result AttachDefaultValues(Host* call,
                                  Local<Object> structure,
                                  const DefaultValues& values) {
  auto jsb = call->js_bridge;
  auto f = jsb->attach_default_values;
  Local<SharedArrayBuffer> data;
  if (values.default_data.len > 0) {
    if (CreateSharedBuffer(call, values.default_data, &data) != Result::OK) {
      return Result::Failure;
    }
  }
  Local<Object> pointers;
  if (values.default_pointer_count > 0) {
    pointers = Object::New(jsb->isolate);
    for (size_t i = 0; i < values.default_pointer_count; i++) {
      if (values.default_pointers[i].len > 0) {
        Local<SharedArrayBuffer> buffer;
        if (CreateSharedBuffer(call, values.default_pointers[i], &buffer) != Result::OK) {
          return Result::Failure;
        }
        pointers->Set(jsb->context, i, buffer).Check();
      }
    }
  }
  auto def = jsb->NewDefaultValues(values.is_static, data, pointers);
  Local<Value> args[2] = { structure, def };
  if (f->Call(jsb->context, Null(jsb->isolate), 2, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result FinalizeStructure(Host* call,
                                Local<Object> structure) {
  auto jsb = call->js_bridge;
  auto f = jsb->finalize_structure;
  Local<Value> args[1] = { structure };
  if (f->Call(call->context, Null(jsb->isolate), 1, args).IsEmpty()) {
    return Result::Failure;
  }
  return Result::OK;
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
  callbacks->get_memory = GetMemory;
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
  auto fd = new FunctionData(isolate, mde);
  ctx.zig_func = fd;
  // TODO: create the bridge on demand
  ctx.js_bridge = new JSBridge(&ctx, js_module, module->flags);
  Local<Object> structure;
  Local<Value> constructor;
  if (module->factory(&ctx, &structure) == Result::OK) {
    auto context = isolate->GetCurrentContext();
    auto t_constructor = String::NewFromUtf8Literal(isolate, "constructor");
    if (structure->Get(context, t_constructor).ToLocal(&constructor)) {
      info.GetReturnValue().Set(constructor);
    }
  }
  delete fd;
  if (constructor.IsEmpty()) {
    Throw("Unable to import functions");
  }
}

static void GetGCStatistics(const FunctionCallbackInfo<Value>& info) {
  auto isolate = info.GetIsolate();
  auto context = isolate->GetCurrentContext();
  auto stats = Object::New(isolate);
  auto set = [&](Local<String> name, int count) {    
    stats->Set(context, name, Int32::NewFromUnsigned(isolate, count)).Check();
  };
  set(String::NewFromUtf8Literal(isolate, "modules"), ModuleData::count);
  set(String::NewFromUtf8Literal(isolate, "functions"), FunctionData::count);
  set(String::NewFromUtf8Literal(isolate, "buffers"), ExternalMemoryData::count);
  info.GetReturnValue().Set(stats);
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
  add(String::NewFromUtf8Literal(isolate, "getGCStatistics"), GetGCStatistics, 0);
} 

int ModuleData::count = 0;
int FunctionData::count = 0;
int ExternalMemoryData::count = 0;
