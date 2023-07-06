#include "addon.h"

static Result AllocateMemory(Host* call,
                             size_t size,
                             Memory* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  if (call->mem_pool.IsEmpty()) {
    call->mem_pool = Array::New(isolate);
  }
  auto buffer = ArrayBuffer::New(isolate, size);
  auto index = call->mem_pool->Length();
  call->mem_pool->Set(context, index, buffer).Check();
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  dest->bytes = reinterpret_cast<uint8_t*>(store->Data());
  dest->len = store->ByteLength();
  return Result::OK;
}

static Result FreeMemory(Host* call,
                         const Memory& memory) {
  if (call->mem_pool.IsEmpty()) {
    return Result::Failure;
  }
  auto context = call->context;
  int buf_count = call->mem_pool->Length();
  int index = -1;
  size_t address = reinterpret_cast<size_t>(memory.bytes);
  for (int i = 0; i < buf_count; i++) {
    MaybeLocal<Value> item = call->mem_pool->Get(context, i);
    if (!item.IsEmpty()) {
      Local<ArrayBuffer> buffer = item.ToLocalChecked().As<ArrayBuffer>();
      if (buffer->ByteLength() == memory.len) {
        std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
        size_t buf_start = reinterpret_cast<size_t>(store->Data());
        if (buf_start == address) {
          index = i;
          break;
        }
      }
    }
  }
  if (index == -1) {
    return Result::Failure;
  }
  call->mem_pool->Delete(context, index).Check();
  return Result::OK;
}

static Result GetMemory(Host* call,
                        Local<Object> object,
                        Memory* dest) {
  auto context = call->context;
  Local<Value> value;
  if (!object->Get(context, call->symbol_memory).ToLocal(&value) || !value->IsDataView()) {
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
  auto isolate = call->isolate;
  // create a reference to the module so that the shared library doesn't get unloaded
  // while the shared buffer is still around pointing to it
  auto mde = Local<External>::New(isolate, call->function_data->module_data);
  auto emd = new ExternalMemoryData(isolate, mde);
  std::shared_ptr<BackingStore> store = SharedArrayBuffer::NewBackingStore(memory.bytes, memory.len,
    [](void*, size_t, void* deleter_data) {
      // get rid of the reference
      auto emd = reinterpret_cast<ExternalMemoryData*>(deleter_data);
      delete emd;
    }, emd);
  *dest = SharedArrayBuffer::New(isolate, store);
  return Result::OK;
}

static Result CreateStackBuffer(Host* call,
                                const Memory& memory,
                                Local<ArrayBuffer>* dest) {
  auto isolate = call->isolate;
  // see if the memory is on the stack
  // since the Host struct is allocated on the stack, its address is the
  // starting point of stack space used by Zig code
  auto stack_top = reinterpret_cast<size_t>(call) + sizeof(Host);
  auto stack_bottom = reinterpret_cast<size_t>(&stack_top);
  auto address = reinterpret_cast<size_t>(memory.bytes);
  if (!(stack_bottom <= address && address + memory.len <= stack_top)) {
    return Result::Failure;
  }
  auto buffer = ArrayBuffer::New(isolate, memory.len);
  std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
  auto bytes = reinterpret_cast<uint8_t*>(store->Data());
  memcpy(bytes, memory.bytes, memory.len);
  *dest = buffer;
  return Result::OK;
}

static Result FindBuffer(Host* call,
                         const Memory& memory,
                         Local<Array> array,
                         Local<ArrayBuffer>* dest,
                         size_t* offset_dest) {
  auto context = call->context;
  auto address = reinterpret_cast<size_t>(memory.bytes);
  int buf_count = array->Length();
  for (int i = 0; i < buf_count; i++) {
    auto item = array->Get(context, i);
    if (!item.IsEmpty()) {
      auto buffer = item.ToLocalChecked().As<ArrayBuffer>();
      if (buffer->ByteLength() >= memory.len) {
        std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
        auto buf_start = reinterpret_cast<size_t>(store->Data());
        auto buf_end = buf_start + store->ByteLength();
        if (buf_start <= address && address + memory.len <= buf_end) {
          *dest = buffer;
          *offset_dest = address - buf_start;
          return Result::OK;
        }
      }
    }
  }
  return Result::Failure;
}

static Result ObtainDataView(Host* call,
                             const Memory& memory,
                             Local<DataView>* dest) {
  // see if the memory is on the stack
  Local<ArrayBuffer> buffer;
  size_t offset;
  if (CreateStackBuffer(call, memory, &buffer) == Result::OK) {
    *dest = DataView::New(buffer, 0, buffer->ByteLength());
    return Result::OK;
  }
  // see if it's from the memory pool
  if (!call->mem_pool.IsEmpty()) {
    if (FindBuffer(call, memory, call->mem_pool, &buffer, &offset) == Result::OK) {
      *dest = DataView::New(buffer, offset, memory.len);
      return Result::OK;
    }
  }
  // see if it's from the arguments
  if (call->arg_buffers.IsEmpty()) {
    if (GetArgumentBuffers(call) != Result::OK) {
      return Result::Failure;
    }
  }
  if (FindBuffer(call, memory, call->arg_buffers, &buffer, &offset) == Result::OK) {
    *dest = DataView::New(buffer, offset, memory.len);
    return Result::OK;
  }
  // mystery memory, create a shared buffer
  Local<SharedArrayBuffer> shared_buffer;
  if (CreateSharedBuffer(call, memory, &shared_buffer) == Result::OK) {
    *dest = DataView::New(shared_buffer, 0, shared_buffer->ByteLength());
    return Result::OK;
  }
  return Result::Failure;
}

static Result WrapMemory(Host* call,
                         Local<Object> structure,
                         const Memory& memory,
                         Local<Object>* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  // find or create array buffer and create data view
  Local<DataView> dv;
  if (ObtainDataView(call, memory, &dv) != Result::OK) {
    return Result::Failure;
  }
  // find constructor
  Local<Value> value;
  auto name = String::NewFromUtf8Literal(isolate, "constructor", NewStringType::kInternalized);
  if (!structure->Get(context, name).ToLocal(&value) || !value->IsFunction()) {
    return Result::Failure;
  }
  auto f = value.As<Function>();
  // indicate we're calling from zig by setting this to ZIG
  auto recv = call->symbol_zig;
  Local<Value> args[1] = { dv };
  if (!f->Call(context, recv, 1, args).ToLocal(&value) || !value->IsObject()) {
    return Result::Failure;
  }
  *dest = value.As<Object>();
  return Result::OK;
}

static Result CreateTemplate(Host* call,
                             const Memory& memory,
                             Local<Object>* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto templ = Object::New(isolate);
  if (memory.bytes) {
    Local<DataView> dv;
    if (ObtainDataView(call, memory, &dv) != Result::OK) {
      return Result::Failure;
    }
    templ->Set(context, call->symbol_memory, dv).Check();
  }
  auto slots = Object::New(isolate);
  templ->Set(context, call->symbol_slots, slots).Check();
  *dest = templ;
  return Result::OK;
}

static Result CreateString(Host* call,
                           const Memory& memory,
                           Local<Value>* dest) {
  auto isolate = call->isolate;
  auto s = reinterpret_cast<char *>(memory.bytes);
  auto len = memory.len;
  if (!String::NewFromUtf8(isolate, s, NewStringType::kNormal, len).ToLocal(dest)) {
    return Result::Failure;
  }
  return Result::OK;
}

static Result GetPointerStatus(Host* call,
                               Local<Object> object,
                               bool* dest) {
  auto context = call->context;
  Local<Value> value;
  if (!object->Get(context, call->symbol_zig).ToLocal(&value) || !value->IsBoolean()) {
    return Result::Failure;
  }
  *dest = value.As<Boolean>()->IsTrue();
  return Result::OK;
}

static Result SetPointerStatus(Host* call,
                               Local<Object> object,
                               bool zig_owned) {
  auto isolate = call->isolate;
  auto context = call->context;
  object->Set(context, call->symbol_zig, Boolean::New(isolate, zig_owned)).Check();
  return Result::OK;
}

static Result ReadGlobalSlot(Host* call,
                             size_t slot_id,
                             Local<Value>* dest) {
  auto context = call->context;
  Local<Value> value;
  if (call->global_slots->Get(context, slot_id).ToLocal(&value)) {
    if (!value->IsNullOrUndefined()) {
      *dest = value;
      return Result::OK;
    }
  }
  return Result::Failure;
}

static Result WriteGlobalSlot(Host* call,
                              size_t slot_id,
                              Local<Value> object) {
  auto isolate = call->isolate;
  auto context = call->context;
  if (!object.IsEmpty()) {
    call->global_slots->Set(context, slot_id, object).Check();
  } else {
    call->global_slots->Set(context, slot_id, Null(isolate)).Check();
  }
  return Result::OK;
}

static Result ReadObjectSlot(Host* call,
                             Local<Object> object,
                             size_t slot,
                             Local<Value>* dest) {
  auto context = call->context;
  Local<Value> value;
  if (!object->Get(context, call->symbol_slots).ToLocal(&value) || !value->IsObject()) {
    return Result::Failure;
  }
  auto relocs = value.As<Object>();
  if (!relocs->Get(context, slot).ToLocal(&value) || value->IsNullOrUndefined()) {
    return Result::Failure;
  }
  *dest = value;
  return Result::OK;
}

static Result WriteObjectSlot(Host* call,
                              Local<Object> object,
                              size_t slot,
                              Local<Value> child) {
  auto isolate = call->isolate;
  auto context = call->context;
  Local<Value> value;
  if (!object->Get(context, call->symbol_slots).ToLocal(&value) || !value->IsObject()) {
    return Result::Failure;
  }
  auto slots = value.As<Object>();
  if (!child.IsEmpty()) {
    slots->Set(context, slot, child).Check();
  } else {
    slots->Set(context, slot, Null(isolate)).Check();
  }
  return Result::OK;
}

static Local<Object> NewStructure(Host* call,
                                  const Structure& s) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto def = Object::New(isolate);
  auto type = Int32::New(isolate, static_cast<int32_t>(s.type));
  auto size = Uint32::NewFromUnsigned(isolate, s.total_size);
  auto has_pointer = Boolean::New(isolate, s.has_pointer);
  def->Set(context, String::NewFromUtf8Literal(isolate, "type"), type).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "size"), size).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "hasPointer"), has_pointer).Check();
  if (s.name) {
    auto name = String::NewFromUtf8(isolate, s.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  return def;
}

static Local<Object> NewMember(Host* call,
                               const Member& m) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto def = Object::New(isolate);
  auto type = Int32::New(isolate, static_cast<int32_t>(m.type));
  auto is_static = Boolean::New(isolate, m.is_static);
  auto is_required = Boolean::New(isolate, m.is_required);
  auto is_const = Boolean::New(isolate, m.is_const);
  def->Set(context, String::NewFromUtf8Literal(isolate, "type"), type).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isStatic"), is_static).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isConst"), is_const).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isRequired"), is_required).Check();
  if (m.type == MemberType::Int) {
    auto is_signed = Boolean::New(isolate, m.is_signed);
    def->Set(context, String::NewFromUtf8Literal(isolate, "isSigned"), is_signed).Check();
  }
  if (m.bit_size != missing) {
    auto bit_size = Uint32::NewFromUnsigned(isolate, m.bit_size);
    def->Set(context, String::NewFromUtf8Literal(isolate, "bitSize"), bit_size).Check();
  }
  if (m.bit_offset != missing) {
    auto bit_offset = Uint32::NewFromUnsigned(isolate, m.bit_offset);
    def->Set(context, String::NewFromUtf8Literal(isolate, "bitOffset"), bit_offset).Check();
  }
  if (m.byte_size != missing) {
    auto byte_size = Uint32::NewFromUnsigned(isolate, m.byte_size);
    def->Set(context, String::NewFromUtf8Literal(isolate, "byteSize"), byte_size).Check();
  }
  if (m.slot != missing) {
    auto slot = Uint32::NewFromUnsigned(isolate, m.slot);
    def->Set(context, String::NewFromUtf8Literal(isolate, "slot"), slot).Check();
  }
  if (!m.structure.IsEmpty()) {
    def->Set(context, String::NewFromUtf8Literal(isolate, "structure"), m.structure).Check();
  }
  if (m.name) {
    auto name = String::NewFromUtf8(isolate, m.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  return def;
}

static Local<Function> NewThunk(Host* call,
                                Thunk thunk) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto module_data = Local<External>::New(isolate, call->function_data->module_data);
  auto fd = new FunctionData(isolate, thunk, module_data);
  auto fde = Local<External>::New(isolate, fd->external);
  return Function::New(context, [](const FunctionCallbackInfo<Value>& info) {
    // Host will extract the FunctionData object created above from the External object
    // which we get from FunctionCallbackInfo::Data()
    Host ctx(info);
    const char* err = ctx.function_data->thunk(&ctx, ctx.argument);
    if (err) {
      auto message = String::NewFromUtf8(ctx.isolate, err).ToLocalChecked();
      info.GetReturnValue().Set(message);
    }
  }, fde, 3).ToLocalChecked();
}

static Local<Object> NewMethod(Host* call,
                               const Method &m) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto thunk = NewThunk(call, m.thunk);
  auto is_static_only = Boolean::New(isolate, m.is_static_only);
  auto def = Object::New(isolate);
  def->Set(context, String::NewFromUtf8Literal(isolate, "argStruct"), m.structure).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "thunk"), thunk).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isStaticOnly"), is_static_only).Check();
  if (m.name) {
    auto name = String::NewFromUtf8(isolate, m.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  return def;
}

static Local<Object> NewTemplate(Host* call,
                                 const ::Template& obj_templ) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto def = Object::New(isolate);
  auto is_static = Boolean::New(isolate, obj_templ.is_static);
  def->Set(context, String::NewFromUtf8Literal(isolate, "isStatic"), is_static).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "template"), obj_templ.object).Check();
  return def;
}

static Result GetJavaScript(Host* call,
                            Local<Object>* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  if (call->js_module.IsEmpty()) {
    auto mde = Local<External>::New(isolate, call->function_data->module_data);
    auto md = reinterpret_cast<ModuleData*>(mde->Value());
    if (md->js_module.IsEmpty()) {
      auto ade = Local<External>::New(isolate, md->addon_data);
      auto ad = reinterpret_cast<AddonData*>(ade->Value());
      Local<Script> script;
      if (ad->js_script.IsEmpty()) {
        // compile the code
        auto source = String::NewFromUtf8Literal(isolate,
          #include "addon.js.txt"
        );
        if (!Script::Compile(context, source).ToLocal(&script)) {
          return Result::Failure;
        }
        // save the script but allow it to be gc'ed
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
      Local<Value> result;
      if (!script->Run(context).ToLocal(&result) || !result->IsObject()) {
        return Result::Failure;
      }
      call->js_module = result.As<Object>();
      // save the module but allow it to be gc'ed
      md->js_module.Reset(isolate, call->js_module);
      md->js_module.template SetWeak<ModuleData>(md,
        [](const v8::WeakCallbackInfo<ModuleData>& data) {
          auto md = data.GetParameter();
          md->js_module.Reset();
        }, WeakCallbackType::kParameter);
    } else {
      call->js_module = Local<Object>::New(isolate, md->js_module);
    }
  }
  *dest = call->js_module;
  return Result::OK;
}

static Result CallFunction(Host* call,
                           Local<String> name,
                           int argc,
                           Local<Value>* argv,
                           Local<Value>* dest = nullptr) {
  auto isolate = call->isolate;
  auto context = call->context;
  Local<Object> module;
  if (GetJavaScript(call, &module) != Result::OK) {
    return Result::Failure;
  }
  Local<Value> value;
  if (!module->Get(context, name).ToLocal<Value>(&value) || !value->IsFunction()) {
    return Result::Failure;
  }
  auto f = value.As<Function>();
  auto recv = Null(isolate);
  if (!f->Call(context, recv, argc, argv).ToLocal<Value>(&value)) {
    return Result::Failure;
  }
  if (dest) {
    *dest = value;
  }
  return Result::OK;
}

static Result BeginStructure(Host* call,
                             const Structure& structure,
                             Local<Object>* dest) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "beginStructure");
  auto mde = Local<External>::New(isolate, call->function_data->module_data);
  auto md = reinterpret_cast<ModuleData*>(mde->Value());
  auto options = Local<Object>::New(isolate, md->js_options);
  auto def = NewStructure(call, structure);
  Local<Value> args[2] = { def, options };
  Local<Value> result;
  if (CallFunction(call, name, 2, args, &result) != Result::OK || !result->IsObject()) {
    return Result::Failure;
  }
  *dest = result.As<Object>();
  return Result::OK;
}

static Result AttachMember(Host* call,
                           Local<Object> structure,
                           const Member& member) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "attachMember");
  auto def = NewMember(call, member);
  Local<Value> args[2] = { structure, def };
  return CallFunction(call, name, 2, args);
}

static Result AttachMethod(Host* call,
                           Local<Object> structure,
                           const Method& method) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "attachMethod");
  auto def = NewMethod(call, method);
  Local<Value> args[2] = { structure, def };
  return CallFunction(call, name, 2, args);
}

static Result AttachTemplate(Host* call,
                             Local<Object> structure,
                             const ::Template& obj_templ) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "attachTemplate");
  auto def = NewTemplate(call, obj_templ);
  Local<Value> args[2] = { structure, def };
  return CallFunction(call, name, 2, args);
}

static Result FinalizeStructure(Host* call,
                                Local<Object> structure) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "finalizeStructure");
  Local<Value> args[] = { structure };
  return CallFunction(call, name, 1, args);
}

static Result GetArgumentBuffers(Host* call) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "getArgumentBuffers");
  Local<Value> args[] = { call->argument };
  Local<Value> result;
  if (CallFunction(call, name, 1, args, &result) != Result::OK || !result->IsArray()) {
    return Result::Failure;
  }
  call->arg_buffers = result.As<Array>();
  return Result::OK;
}

static Result Log(Host* call,
                  size_t argc,
                  Local<Value>* argv) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "log");
  return CallFunction(call, name, argc, argv);
}

static void Load(const FunctionCallbackInfo<Value>& info) {
  auto isolate = info.GetIsolate();
  auto context = isolate->GetCurrentContext();
  auto Throw = [&](const char* message) {
    Local<String> string;
    if (String::NewFromUtf8(isolate, message).ToLocal<String>(&string)) {
      isolate->ThrowError(string);
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

  // attach callbacks to module
  auto module = reinterpret_cast<::Module*>(symbol);
  auto callbacks = module->callbacks;
  callbacks->allocate_memory = AllocateMemory;
  callbacks->free_memory = FreeMemory;
  callbacks->get_memory = GetMemory;
  callbacks->wrap_memory = WrapMemory;
  callbacks->get_pointer_status = GetPointerStatus;
  callbacks->set_pointer_status = SetPointerStatus;
  callbacks->read_global_slot = ReadGlobalSlot;
  callbacks->write_global_slot = WriteGlobalSlot;
  callbacks->read_object_slot = ReadObjectSlot;
  callbacks->write_object_slot = WriteObjectSlot;
  callbacks->begin_structure = BeginStructure;
  callbacks->attach_member = AttachMember;
  callbacks->attach_method = AttachMethod;
  callbacks->attach_template = AttachTemplate;
  callbacks->finalize_structure = FinalizeStructure;
  callbacks->create_template = CreateTemplate;
  callbacks->create_string = CreateString;
  callbacks->log_values = Log;

  // save handle to external object, along with options and AddonData
  auto options = Object::New(isolate);
  auto little_endian = Boolean::New(isolate, module->flags.little_endian);
  auto runtime_safety = Boolean::New(isolate, module->flags.runtime_safety);
  options->Set(context, String::NewFromUtf8Literal(isolate, "littleEndian"), little_endian).Check();
  options->Set(context, String::NewFromUtf8Literal(isolate, "realTimeSafety"), runtime_safety).Check();
  auto md = new ModuleData(isolate, handle, options, info.Data().As<External>());

  // invoke the factory thunk through JavaScript, which will give us the
  // needed symbols and slots
  Host ctx(isolate, Local<External>::New(isolate, md->external));
  auto factory = NewThunk(&ctx, module->factory);
  auto name = String::NewFromUtf8Literal(isolate, "invokeFactory");
  Local<Value> args[1] = { factory };
  Local<Value> result;
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

int AddonData::script_count = 0;
int ModuleData::count = 0;
int FunctionData::count = 0;
int ExternalMemoryData::count = 0;
