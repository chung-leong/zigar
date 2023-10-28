#include "addon.h"

static Local<Function> CreateThunk(Isolate* isolate,
                                   FunctionData* fd) {
  auto context = isolate->GetCurrentContext();
  auto fde = Local<External>::New(isolate, fd->external);
  return Function::New(context, [](const FunctionCallbackInfo<Value>& info) {
    Call ctx(info.GetIsolate(), info.This(), info.Data().As<External>());
    const char* err = ctx.function_data->thunk(&ctx, info[0]);
    if (err) {
      auto message = String::NewFromUtf8(ctx.isolate, err).ToLocalChecked();
      info.GetReturnValue().Set(message);
      return;
    }
  }, fde, 3).ToLocalChecked();
}

static Result CallFunction(Call* call,
                           Local<String> name,
                           int argc,
                           Local<Value>* argv,
                           Local<Value>* dest = nullptr) {
  auto context = call->context;
  Local<Value> value;
  if (!call->env->Get(context, name).ToLocal<Value>(&value) || !value->IsFunction()) {
    return Result::Failure;
  }
  auto f = value.As<Function>();
  if (!f->Call(context, call->env, argc, argv).ToLocal<Value>(&value)) {
    return Result::Failure;
  }
  if (dest) {
    *dest = value;
  }
  return Result::OK;
}

static Result AllocateMemory(Call* call,
                             size_t len,
                             uint8_t ptr_align,
                             Memory* dest) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "allocMemory");
  Local<Value> args[] = {
    Number::New(isolate, len),
    Uint32::NewFromUnsigned(isolate, ptr_align)
  };
  Local<Value> result;
  if (CallFunction(call, fname, 2, args, &result) != Result::OK || !result->IsDataView()) {
    return Result::Failure;
  }
  auto dv = result.As<DataView>();
  std::shared_ptr<BackingStore> store = dv->Buffer()->GetBackingStore();
  dest->bytes = reinterpret_cast<uint8_t*>(store->Data()) + dv->ByteOffset();
  dest->len = len;
  dest->attributes.is_const = false;
  dest->attributes.is_comptime = false;
  dest->attributes.ptr_align = ptr_align;
  return Result::OK;
}

static Result FreeMemory(Call* call,
                         const Memory& memory,
                         uint8_t ptr_align) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "freeMemory");
  auto address = reinterpret_cast<size_t>(memory.bytes);
  Local<Value> args[] = {
    BigInt::NewFromUnsigned(isolate, address),
    Number::New(isolate, memory.len),
    Uint32::NewFromUnsigned(isolate, memory.attributes.ptr_align),
  };
  Local<Value> result;
  if (CallFunction(call, fname, 3, args, &result) != Result::OK) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result CreateView(Call* call,
                         const Memory& memory,
                         Local<DataView>* dest) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "createView");
  auto address = reinterpret_cast<size_t>(memory.bytes);
  Local<Value> args[] = {
    BigInt::NewFromUnsigned(isolate, address),
    Number::New(isolate, memory.len),
    Uint32::NewFromUnsigned(isolate, memory.attributes.ptr_align),
    Boolean::New(isolate, memory.attributes.is_comptime),
  };
  Local<Value> result;
  if (CallFunction(call, fname, 4, args, &result) != Result::OK || !result->IsDataView()) {
    return Result::Failure;
  }
  *dest = result.As<DataView>();
  return Result::OK;
}

static Result CreateObject(Call* call,
                           Local<Object> structure,
                           Local<DataView> dv,
                           Local<Object>* dest) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "createObject");
  Local<Value> args[] = { structure, dv };
  Local<Value> result;
  if (CallFunction(call, fname, 2, args, &result) != Result::OK || !result->IsObject()) {
    return Result::Failure;
  }
  *dest = result.As<Object>();
  return Result::OK;
}

static Result CreateTemplate(Call* call,
                             Local<DataView> dv,
                             Local<Object>* dest) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "createTemplate");
  Local<Value> args[] = { dv };
  Local<Value> result;
  if (CallFunction(call, fname, 1, args, &result) != Result::OK || !result->IsObject()) {
    return Result::Failure;
  }
  *dest = result.As<Object>();
  return Result::OK;
}

static Result ReadSlot(Call* call,
                       Local<Object> object,
                       size_t slot,
                       Local<Value>* dest) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "readSlot");
  Local<Value> args[] = {
    object.IsEmpty() ? Null(isolate).As<Value>() : object.As<Value>(),
    Uint32::NewFromUnsigned(isolate, slot),
  };
  Local<Value> result;
  if (CallFunction(call, fname, 2, args, &result) != Result::OK || !result->IsObject()) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result WriteSlot(Call* call,
                        Local<Object> object,
                        size_t slot,
                        Local<Value> value) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "writeSlot");
  Local<Value> args[] = {
    object.IsEmpty() ? Null(isolate).As<Value>() : object.As<Value>(),
    Uint32::NewFromUnsigned(isolate, slot),
    value.IsEmpty() ? Null(isolate).As<Value>() : value,
  };
  Local<Value> result;
  if (CallFunction(call, fname, 3, args, &result) != Result::OK) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result BeginStructure(Call* call,
                             const Structure& structure,
                             Local<Object>* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto def = Object::New(isolate);
  auto type = Int32::New(isolate, static_cast<int32_t>(structure.type));
  auto length = Uint32::NewFromUnsigned(isolate, structure.length);
  auto byte_size = Uint32::NewFromUnsigned(isolate, structure.byte_size);
  auto align = Uint32::NewFromUnsigned(isolate, structure.ptr_align);
  auto is_const = Boolean::New(isolate, structure.is_const);
  auto has_pointer = Boolean::New(isolate, structure.has_pointer);
  def->Set(context, String::NewFromUtf8Literal(isolate, "type"), type).Check();
  if (structure.type == StructureType::Array || structure.type == StructureType::Vector) {
    def->Set(context, String::NewFromUtf8Literal(isolate, "length"), length).Check();
  }
  def->Set(context, String::NewFromUtf8Literal(isolate, "byteSize"), byte_size).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "align"), align).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isConst"), is_const).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "hasPointer"), has_pointer).Check();
  if (structure.name) {
    auto name = String::NewFromUtf8(isolate, structure.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  auto mde = Local<External>::New(isolate, call->function_data->module_data);
  auto md = reinterpret_cast<ModuleData*>(mde->Value());
  auto fname = String::NewFromUtf8Literal(isolate, "beginStructure");
  Local<Value> args[2] = {
    def,
    Local<Object>::New(isolate, md->js_options),
  };
  Local<Value> result;
  if (CallFunction(call, fname, 2, args, &result) != Result::OK || !result->IsObject()) {
    return Result::Failure;
  }
  *dest = result.As<Object>();
  return Result::OK;
}

static Result AttachMember(Call* call,
                           Local<Object> structure,
                           const Member& member,
                           bool is_static) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto name = String::NewFromUtf8Literal(isolate, "attachMember");
  auto def = Object::New(isolate);
  auto type = Int32::New(isolate, static_cast<int32_t>(member.type));
  auto is_required = Boolean::New(isolate, member.is_required);
  def->Set(context, String::NewFromUtf8Literal(isolate, "type"), type).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isRequired"), is_required).Check();
  if (member.bit_size != missing) {
    auto bit_size = Uint32::NewFromUnsigned(isolate, member.bit_size);
    def->Set(context, String::NewFromUtf8Literal(isolate, "bitSize"), bit_size).Check();
  }
  if (member.bit_offset != missing) {
    auto bit_offset = Uint32::NewFromUnsigned(isolate, member.bit_offset);
    def->Set(context, String::NewFromUtf8Literal(isolate, "bitOffset"), bit_offset).Check();
  }
  if (member.byte_size != missing) {
    auto byte_size = Uint32::NewFromUnsigned(isolate, member.byte_size);
    def->Set(context, String::NewFromUtf8Literal(isolate, "byteSize"), byte_size).Check();
  }
  if (member.slot != missing) {
    auto slot = Uint32::NewFromUnsigned(isolate, member.slot);
    def->Set(context, String::NewFromUtf8Literal(isolate, "slot"), slot).Check();
  }
  if (!member.structure.IsEmpty()) {
    def->Set(context, String::NewFromUtf8Literal(isolate, "structure"), member.structure).Check();
  }
  if (member.name) {
    auto name = String::NewFromUtf8(isolate, member.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  Local<Value> args[3] = {
    structure,
    def,
    Boolean::New(isolate, is_static),
  };
  return CallFunction(call, name, 3, args);
}

static Result AttachMethod(Call* call,
                           Local<Object> structure,
                           const Method& method,
                           bool is_static_only) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto mde = Local<External>::New(isolate, call->function_data->module_data);
  auto fd = new FunctionData(isolate, method.thunk, method.attributes, mde);
  auto thunk = CreateThunk(isolate, fd);
  auto def = Object::New(isolate);
  def->Set(context, String::NewFromUtf8Literal(isolate, "argStruct"), method.structure).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "thunk"), thunk).Check();
  if (method.name) {
    auto name = String::NewFromUtf8(isolate, method.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  auto fname = String::NewFromUtf8Literal(isolate, "attachMethod");
  Local<Value> args[] = {
    structure,
    def,
    Boolean::New(isolate, is_static_only),
  };
  return CallFunction(call, fname, 3, args);
}

static Result AttachTemplate(Call* call,
                             Local<Object> structure,
                             Local<Object> templateObj,
                             bool is_static) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "attachTemplate");
  Local<Value> args[] = {
    structure,
    templateObj,
    Boolean::New(isolate, is_static),
  };
  return CallFunction(call, fname, 3, args);
}

static Result FinalizeStructure(Call* call,
                                Local<Object> structure) {
  auto isolate = call->isolate;
  auto fname = String::NewFromUtf8Literal(isolate, "finalizeStructure");
  Local<Value> args[] = { structure };
  return CallFunction(call, fname, 1, args);
}

static Result WriteToConsole(Call* call,
                             const Memory& memory) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "writeToConsole");
  auto buffer = ArrayBuffer::New(isolate, memory.len);
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  auto bytes = reinterpret_cast<uint8_t*>(store->Data());
  memcpy(bytes, memory.bytes, memory.len);
  Local<Value> args[] = { buffer };
  return CallFunction(call, name, 1, args);
}

static Result FlushConsole(Call* call) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "flushConsole");
  Local<Value> args[] = {};
  return CallFunction(call, name, 0, args);
}

static MaybeLocal<Value> LoadJavaScript(Isolate* isolate,
                                        AddonData* ad) {
  auto context = isolate->GetCurrentContext();
  Local<Script> script;
  if (ad->js_script.IsEmpty()) {
    // compile the code
    auto source = String::NewFromUtf8Literal(isolate,
      #include "addon.js.txt"
    );
    if (!Script::Compile(context, source).ToLocal(&script)) {
      return Null(isolate);
    }
    // save the script but allow it to be gc'ed--it's needed only when
    // Node starts and multiple Zigar modules are being loaded
    ad->script_count++;
    ad->js_script.Reset(isolate, script);
    ad->js_script.template SetWeak<AddonData>(ad,
      [](const v8::WeakCallbackInfo<AddonData>& data) {
        auto ad = data.GetParameter();
        ad->js_script.Reset();
        ad->script_count--;
      }, WeakCallbackType::kParameter);
  } else {
    script = Local<Script>::New(isolate, ad->js_script);
  }
  // run iife
  return script->Run(context);
}

static void OverrideEnvironmentFunctions(Isolate* isolate,
                                         Local<Function> constructor,
                                         Local<External> module_data) {
  auto context = isolate->GetCurrentContext();
  auto prototype = constructor->Get(context, String::NewFromUtf8Literal(isolate, "prototype")).ToLocalChecked().As<Object>();
  auto add = [&](Local<String> name, void (*f)(const FunctionCallbackInfo<Value>& info), int length) {
    auto tmpl = FunctionTemplate::New(isolate, f, module_data, Local<Signature>(), length, ConstructorBehavior::kThrow, SideEffectType::kHasNoSideEffect);
    auto function = tmpl->GetFunction(isolate->GetCurrentContext()).ToLocalChecked();
    prototype->Set(context, name, function).Check();
  };
  add(String::NewFromUtf8Literal(isolate, "getAddress"), [](const FunctionCallbackInfo<Value>& info) {
    if (!info[0]->IsArrayBuffer()) {
      return;
    }
    auto isolate = info.GetIsolate();
    auto buffer = info[0].As<ArrayBuffer>();
    auto store = buffer->GetBackingStore();
    auto address = reinterpret_cast<size_t>(store->Data());
    auto big_int = BigInt::NewFromUnsigned(isolate, address);
    info.GetReturnValue().Set(big_int);
  }, 1);
  add(String::NewFromUtf8Literal(isolate, "obtainView"), [](const FunctionCallbackInfo<Value>& info) {
    if (!(info[0]->IsBigInt() && info[1]->IsBigInt())) {
      return;
    }
    auto isolate = info.GetIsolate();
    auto mde = info.Data().As<External>();
    auto address = info[0].As<BigInt>()->Uint64Value();
    auto len = info[1].As<BigInt>()->Uint64Value();
    auto src_bytes = reinterpret_cast<uint8_t*>(address);
    // create a reference to the module so that the shared library doesn't get unloaded
    // while the shared buffer is still around pointing to it
    auto emd = new ExternalMemoryData(isolate, mde);
    std::shared_ptr<BackingStore> store = SharedArrayBuffer::NewBackingStore(src_bytes, len, [](void*, size_t, void* deleter_data) {
      // get rid of the reference
      auto emd = reinterpret_cast<ExternalMemoryData*>(deleter_data);
      delete emd;
    }, emd);
    auto buffer = SharedArrayBuffer::New(isolate, store);
    auto dv = DataView::New(buffer, 0, len);
    info.GetReturnValue().Set(dv);
  }, 2);
  add(String::NewFromUtf8Literal(isolate, "copyBytes"), [](const FunctionCallbackInfo<Value>& info) {
    if (!(info[0]->IsDataView() && info[1]->IsBigInt() && info[2]->IsBigInt())) {
      return;
    }
    auto dst = info[0].As<DataView>();
    auto address = info[0].As<BigInt>()->Uint64Value();
    auto len = info[1].As<BigInt>()->Uint64Value();
    if (dst->ByteLength() != len) {
      return;
    }
    auto src_bytes = reinterpret_cast<const uint8_t*>(address);
    auto dst_store = dst->Buffer()->GetBackingStore();
    auto dst_bytes = reinterpret_cast<uint8_t*>(dst_store->Data()) + dst->ByteOffset();
    memcpy(dst_bytes, src_bytes, len);
  }, 3);
}

static void Load(const FunctionCallbackInfo<Value>& info) {
  auto isolate = info.GetIsolate();
  auto context = isolate->GetCurrentContext();
  auto Throw = [&](const char* message) {
    Local<String> string;
    if (String::NewFromUtf8(isolate, message).ToLocal<String>(&string)) {
      isolate->ThrowException(Exception::Error(string));
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

  // load JavaScript
  auto ade = info.Data().As<External>();
  auto ad = reinterpret_cast<AddonData*>(ade->Value());
  Local<Value> result;
  if (!LoadJavaScript(isolate, ad).ToLocal(&result) || !result->IsObject()) {
    Throw("Unable to compile embedded JavaScript");
    return;
  }
  auto js_module = result.As<Object>();
  // look for the Environment class
  if (js_module->Get(context, String::NewFromUtf8Literal(isolate, "Environment")).ToLocal(&result) || !result->IsFunction()) {
    Throw("Unable to find the class \"Environment\"");
    return;
  }
  auto env_constructor = result.As<Function>();

  // attach callbacks to module
  auto module = reinterpret_cast<::Module*>(symbol);
  auto callbacks = module->callbacks;
  callbacks->allocate_memory = AllocateMemory;
  callbacks->free_memory = FreeMemory;
  callbacks->create_view = CreateView;
  callbacks->create_object = CreateObject;
  callbacks->read_slot = ReadSlot;
  callbacks->write_slot = WriteSlot;
  callbacks->begin_structure = BeginStructure;
  callbacks->attach_member = AttachMember;
  callbacks->attach_method = AttachMethod;
  callbacks->attach_template = AttachTemplate;
  callbacks->finalize_structure = FinalizeStructure;
  callbacks->create_template = CreateTemplate;
  callbacks->write_to_console = WriteToConsole;
  callbacks->flush_console = FlushConsole;

  // save handle to external object, along with options and AddonData
  auto options = Object::New(isolate);
  auto little_endian = Boolean::New(isolate, module->attributes.little_endian);
  auto runtime_safety = Boolean::New(isolate, module->attributes.runtime_safety);
  options->Set(context, String::NewFromUtf8Literal(isolate, "littleEndian"), little_endian).Check();
  options->Set(context, String::NewFromUtf8Literal(isolate, "runtimeSafety"), runtime_safety).Check();
  auto md = new ModuleData(isolate, handle, options, ade);
  auto mde = Local<External>::New(isolate, md->external);

  // add functions to Environment
  OverrideEnvironmentFunctions(isolate, env_constructor, mde);

  // invoke the factory thunk through JavaScript
  auto fd = new FunctionData(isolate, module->factory, MethodAttributes{ .has_pointer = false }, mde);
  auto fde = Local<External>::New(isolate, fd->external);
  auto ff = CreateThunk(isolate, fd);
  auto env = env_constructor->CallAsConstructor(context, 0, nullptr).ToLocalChecked().As<Object>();
  auto name = String::NewFromUtf8Literal(isolate, "invokeFactory");
  Local<Value> args[1] = { ff };
  Call ctx(isolate, env, fde);
  if (CallFunction(&ctx, name, 1, args, &result) != Result::OK) {
    // an error will have been thrown already
    return;
  }
  info.GetReturnValue().Set(result);
}

static void GetGCStatistics(const FunctionCallbackInfo<Value>& info) {
  auto isolate = info.GetIsolate();
  auto context = isolate->GetCurrentContext();
  auto stats = Object::New(isolate);
  auto set = [&](Local<String> name, int count) {
    stats->Set(context, name, Int32::NewFromUnsigned(isolate, count)).Check();
  };
  set(String::NewFromUtf8Literal(isolate, "scripts"), AddonData::script_count);
  set(String::NewFromUtf8Literal(isolate, "modules"), ModuleData::count);
  set(String::NewFromUtf8Literal(isolate, "functions"), FunctionData::count);
  set(String::NewFromUtf8Literal(isolate, "buffers"), ExternalMemoryData::count);
  info.GetReturnValue().Set(stats);
}

DISABLE_WCAST_FUNCTION_TYPE
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
DISABLE_WCAST_FUNCTION_TYPE_END

int AddonData::script_count = 0;
int ModuleData::count = 0;
int FunctionData::count = 0;
int ExternalMemoryData::count = 0;
