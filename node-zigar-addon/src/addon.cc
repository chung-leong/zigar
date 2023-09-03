#include "addon.h"

static size_t GetExtraCount(uint8_t ptr_align) {
  size_t alignment = (1 << ptr_align);
  size_t default_alignment = sizeof(size_t) * 2;
  return (alignment <= default_alignment) ? 0 : alignment;
}

static Memory GetArrayBufferMemory(Local<ArrayBuffer> buffer) {
  auto store = buffer->GetBackingStore();
  Memory mem = {
    reinterpret_cast<uint8_t*>(store->Data()),
    store->ByteLength(),
  };
  return mem;
}

static Memory GetDataViewMemory(Local<DataView> dv) {
  auto buffer = dv->Buffer();
  auto byteOffset = dv->ByteOffset();
  auto byteLength = dv->ByteLength();
  auto mem = GetArrayBufferMemory(buffer);
  mem.bytes += byteOffset;
  mem.len = byteLength;
  return mem;
}

static bool IsMisaligned(Memory memory,
                         uint8_t ptr_align) {
  auto address = reinterpret_cast<size_t>(memory.bytes);
  size_t unaligned_mask = (1 << ptr_align) - 1;
  return (address & unaligned_mask) != 0;
}

static Memory GetAlignedBufferMemory(Local<ArrayBuffer> buffer,
                                     uint8_t ptr_align) {
  auto mem = GetArrayBufferMemory(buffer);
  auto extra = GetExtraCount(ptr_align);
  if (extra != 0) {
    auto address = reinterpret_cast<size_t>(mem.bytes);
    auto address_mask = ~(extra - 1);
    auto aligned_address = (address & address_mask) + extra;
    mem.bytes = reinterpret_cast<uint8_t*>(aligned_address);
    mem.len -= aligned_address - address;
  }
  return mem;
}

static Result AllocateMemory(Call* call,
                             size_t len,
                             uint8_t ptr_align,
                             Memory* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  if (call->mem_pool.IsEmpty()) {
    call->mem_pool = Array::New(isolate);
  }
  auto buffer = ArrayBuffer::New(isolate, len + GetExtraCount(ptr_align));
  *dest = GetAlignedBufferMemory(buffer, ptr_align);
  auto index = call->mem_pool->Length();
  call->mem_pool->Set(context, index, buffer).Check();
  return Result::OK;
}

static Result FreeMemory(Call* call,
                         const Memory& memory,
                         uint8_t ptr_align) {
  if (call->mem_pool.IsEmpty()) {
    return Result::Failure;
  }
  auto context = call->context;
  auto extra = GetExtraCount(ptr_align);
  auto buf_count = call->mem_pool->Length();
  uint32_t index = 0xFFFFFFFF;
  for (uint32_t i = 0; i < buf_count; i++) {
    auto item = call->mem_pool->Get(context, i).ToLocalChecked();
    if (item->IsArrayBuffer()) {
      auto buffer = item.As<ArrayBuffer>();
      if (buffer->ByteLength() == memory.len + extra) {
        auto mem = GetAlignedBufferMemory(buffer, ptr_align);
        if (mem.bytes == memory.bytes) {
          index = i;
          break;
        }
      }
    }
  }
  if (index == 0xFFFFFFFF) {
    return Result::Failure;
  }
  call->mem_pool->Delete(context, index).Check();
  return Result::OK;
}

static Result GetMemory(Call* call,
                        Local<Object> object,
                        uint8_t ptr_align,
                        Memory* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  Local<Value> value;
  if (!object->Get(context, call->symbol_memory).ToLocal(&value) || !value->IsDataView()) {
    return Result::Failure;
  }
  auto dv = value.As<DataView>();
  auto mem = GetDataViewMemory(dv);
  if (IsMisaligned(mem, ptr_align)) {
    // memory is misaligned, need to create a shadow buffer for it
    if (call->shadow_map.IsEmpty()) {
      call->shadow_map = Map::New(isolate);
    }
    Local<Value> existing = call->shadow_map->Get(context, dv).ToLocalChecked();
    if (existing->IsArrayBuffer()) {
      auto shadow_buffer = existing.As<ArrayBuffer>();
      mem = GetAlignedBufferMemory(shadow_buffer, ptr_align);
    } else {
      auto shadow_buffer = ArrayBuffer::New(isolate, dv->ByteLength() + GetExtraCount(ptr_align));
      shadow_buffer->Set(context, 0, Int32::New(isolate, ptr_align)).Check();
      call->shadow_map->Set(context, dv, shadow_buffer).ToLocalChecked();
      auto dest_mem = GetAlignedBufferMemory(shadow_buffer, ptr_align);
      memcpy(dest_mem.bytes, mem.bytes, mem.len);
      mem = dest_mem;
    }
  }
  *dest = mem;
  return Result::OK;
}

static Result ResyncShadows(Call* call) {
  if (!call->shadow_map.IsEmpty()) {
    auto context = call->context;
    auto array = call->shadow_map->AsArray();
    for (size_t i = 0; i < array->Length(); i += 2) {
      auto key = array->Get(context, i).ToLocalChecked();
      auto value = array->Get(context, i + 1).ToLocalChecked();
      auto dv = key.As<DataView>();
      auto shadow_buffer = value.As<ArrayBuffer>();
      auto ptr_align = static_cast<uint8_t>(shadow_buffer->Get(context, 0).ToLocalChecked().As<Int32>()->Value());
      auto mem = GetAlignedBufferMemory(shadow_buffer, ptr_align);
      auto dest_mem = GetDataViewMemory(dv);
      memcpy(dest_mem.bytes, mem.bytes, mem.len);
    }
  }
  return Result::OK;
}

static Result FindBuffer(Call* call,
                         const Memory& memory,
                         Local<Array> array,
                         Local<ArrayBuffer>* dest,
                         size_t* offset_dest) {
  auto context = call->context;
  auto address = reinterpret_cast<size_t>(memory.bytes);
  int buf_count = array->Length();
  for (int i = 0; i < buf_count; i++) {
    auto item = array->Get(context, i).ToLocalChecked();
    if (item->IsArrayBuffer()) {
      auto buffer = item.As<ArrayBuffer>();
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

static Result ObtainDataView(Call* call,
                             const Memory& memory,
                             MemoryDisposition disposition,
                             Local<DataView>* dest) {
  auto isolate = call->isolate;
  if (disposition == MemoryDisposition::Copy) {
    auto buffer = ArrayBuffer::New(isolate, memory.len);
    std::shared_ptr<BackingStore> store = buffer->GetBackingStore();
    auto bytes = reinterpret_cast<uint8_t*>(store->Data());
    memcpy(bytes, memory.bytes, memory.len);
    *dest = DataView::New(buffer, 0, memory.len);
    return Result::OK;
  } else if (disposition == MemoryDisposition::Auto) {
    // see if it's from the memory pool
    Local<ArrayBuffer> buffer;
    size_t offset;
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
  }
  // mystery memory, create a shared buffer
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
  auto shared_buffer = SharedArrayBuffer::New(isolate, store);
  *dest = DataView::New(shared_buffer, 0, memory.len);
  return Result::OK;
}

static Result WrapMemory(Call* call,
                         Local<Object> structure,
                         const Memory& memory,
                         MemoryDisposition disposition,
                         Local<Object>* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  // find or create array buffer and create data view
  Local<DataView> dv;
  if (ObtainDataView(call, memory, disposition, &dv) != Result::OK) {
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

static Result CreateTemplate(Call* call,
                             const Memory& memory,
                             Local<Object>* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto templ = Object::New(isolate);
  if (memory.bytes) {
    Local<DataView> dv;
    if (ObtainDataView(call, memory, MemoryDisposition::Copy, &dv) != Result::OK) {
      return Result::Failure;
    }
    templ->Set(context, call->symbol_memory, dv).Check();
  }
  auto slots = Object::New(isolate);
  templ->Set(context, call->symbol_slots, slots).Check();
  *dest = templ;
  return Result::OK;
}

static Result GetPointerStatus(Call* call,
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

static Result SetPointerStatus(Call* call,
                               Local<Object> object,
                               bool zig_owned) {
  auto isolate = call->isolate;
  auto context = call->context;
  object->Set(context, call->symbol_zig, Boolean::New(isolate, zig_owned)).Check();
  return Result::OK;
}

static Result ReadGlobalSlot(Call* call,
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

static Result WriteGlobalSlot(Call* call,
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

static Result ReadObjectSlot(Call* call,
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

static Result WriteObjectSlot(Call* call,
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

static Local<Object> NewStructure(Call* call,
                                  const Structure& s) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto def = Object::New(isolate);
  auto type = Int32::New(isolate, static_cast<int32_t>(s.type));
  auto size = Uint32::NewFromUnsigned(isolate, s.total_size);
  auto align = Uint32::NewFromUnsigned(isolate, s.ptr_align);
  auto is_const = Boolean::New(isolate, s.is_const);
  auto has_pointer = Boolean::New(isolate, s.has_pointer);
  def->Set(context, String::NewFromUtf8Literal(isolate, "type"), type).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "size"), size).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "align"), align).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "isConst"), is_const).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "hasPointer"), has_pointer).Check();
  if (s.name) {
    auto name = String::NewFromUtf8(isolate, s.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  return def;
}

static Local<Object> NewMember(Call* call,
                               const Member& m) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto def = Object::New(isolate);
  auto type = Int32::New(isolate, static_cast<int32_t>(m.type));
  auto is_required = Boolean::New(isolate, m.is_required);
  def->Set(context, String::NewFromUtf8Literal(isolate, "type"), type).Check();
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

static Local<Function> NewThunk(Call* call,
                                Thunk thunk) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto module_data = Local<External>::New(isolate, call->function_data->module_data);
  auto fd = new FunctionData(isolate, thunk, module_data);
  auto fde = Local<External>::New(isolate, fd->external);
  return Function::New(context, [](const FunctionCallbackInfo<Value>& info) {
    // Call will extract the FunctionData object created above from the External object
    // which we get from FunctionCallbackInfo::Data()
    Call ctx(info);
    const char* err = ctx.function_data->thunk(&ctx, ctx.argument);
    ResyncShadows(&ctx);
    if (err) {
      auto message = String::NewFromUtf8(ctx.isolate, err).ToLocalChecked();
      info.GetReturnValue().Set(message);
    }
  }, fde, 3).ToLocalChecked();
}

static Local<Object> NewMethod(Call* call,
                               const Method &m) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto thunk = NewThunk(call, m.thunk);
  auto def = Object::New(isolate);
  def->Set(context, String::NewFromUtf8Literal(isolate, "argStruct"), m.structure).Check();
  def->Set(context, String::NewFromUtf8Literal(isolate, "thunk"), thunk).Check();
  if (m.name) {
    auto name = String::NewFromUtf8(isolate, m.name).ToLocalChecked();
    def->Set(context, String::NewFromUtf8Literal(isolate, "name"), name).Check();
  }
  return def;
}

static Result GetJavaScript(Call* call,
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

static Result CallFunction(Call* call,
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

static Result BeginStructure(Call* call,
                             const Structure& structure,
                             Local<Object>* dest) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "beginStructure");
  auto mde = Local<External>::New(isolate, call->function_data->module_data);
  auto md = reinterpret_cast<ModuleData*>(mde->Value());
  Local<Value> args[2] = {
    NewStructure(call, structure),
    Local<Object>::New(isolate, md->js_options),
  };
  Local<Value> result;
  if (CallFunction(call, name, 2, args, &result) != Result::OK || !result->IsObject()) {
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
  auto name = String::NewFromUtf8Literal(isolate, "attachMember");
  Local<Value> args[3] = {
    structure,
    NewMember(call, member),
    Boolean::New(isolate, is_static),
  };
  return CallFunction(call, name, 3, args);
}

static Result AttachMethod(Call* call,
                           Local<Object> structure,
                           const Method& method,
                           bool is_static_only) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "attachMethod");
  Local<Value> args[3] = {
    structure,
    NewMethod(call, method),
    Boolean::New(isolate, is_static_only),
  };
  return CallFunction(call, name, 3, args);
}

static Result AttachTemplate(Call* call,
                             Local<Object> structure,
                             Local<Object> templateObj,
                             bool is_static) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "attachTemplate");
  Local<Value> args[3] = {
    structure,
    templateObj,
    Boolean::New(isolate, is_static),
  };
  return CallFunction(call, name, 3, args);
}

static Result FinalizeStructure(Call* call,
                                Local<Object> structure) {
  auto isolate = call->isolate;
  auto name = String::NewFromUtf8Literal(isolate, "finalizeStructure");
  Local<Value> args[] = { structure };
  return CallFunction(call, name, 1, args);
}

static Result GetArgumentBuffers(Call* call) {
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

static Result WriteToConsole(Call* call, const Memory& memory) {
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
  Local<Value> args[0] = {};
  return CallFunction(call, name, 0, args);
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
  callbacks->write_to_console = WriteToConsole;
  callbacks->flush_console = FlushConsole;

  // save handle to external object, along with options and AddonData
  auto options = Object::New(isolate);
  auto little_endian = Boolean::New(isolate, module->flags.little_endian);
  auto runtime_safety = Boolean::New(isolate, module->flags.runtime_safety);
  options->Set(context, String::NewFromUtf8Literal(isolate, "littleEndian"), little_endian).Check();
  options->Set(context, String::NewFromUtf8Literal(isolate, "runtimeSafety"), runtime_safety).Check();
  auto md = new ModuleData(isolate, handle, options, info.Data().As<External>());

  // invoke the factory thunk through JavaScript, which will give us the
  // needed symbols and slots
  Call ctx(isolate, Local<External>::New(isolate, md->external));
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
