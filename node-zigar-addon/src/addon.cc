#include "addon.h"

static size_t GetExtraCount(uint8_t ptr_align) {
  size_t alignment = (1 << ptr_align);
  size_t default_alignment = sizeof(size_t) * 2;
  return (alignment <= default_alignment) ? 0 : alignment;
}

static Memory GetArrayBufferMemory(Call* call,
                                   Local<ArrayBuffer> buffer) {
  if (buffer->IsSharedArrayBuffer()) {
    auto context = call->context;
    auto isolate = call->isolate;
    auto memory_prop = buffer->Get(context, call->symbol_memory).ToLocalChecked();
    if (memory_prop->IsObject()) {
      auto source = memory_prop.As<Object>();
      auto address_name = String::NewFromUtf8Literal(isolate, "address");
      auto len_name = String::NewFromUtf8Literal(isolate, "len");
      auto address_value = source->Get(context, address_name).ToLocalChecked();
      auto len_value = source->Get(context, len_name).ToLocalChecked();
      size_t address = address_value.As<BigInt>()->Uint64Value();
      size_t len = len_value.As<BigInt>()->Uint64Value();
      Memory mem = {
        reinterpret_cast<uint8_t*>(address),
        len,
      };
      return mem;
    }
  }
  auto store = buffer->GetBackingStore();
  Memory mem = {
    reinterpret_cast<uint8_t*>(store->Data()),
    store->ByteLength(),
  };
  return mem;
}

static Memory GetDataViewMemory(Call* call,
                                Local<DataView> dv) {
  auto buffer = dv->Buffer();
  auto byteOffset = dv->ByteOffset();
  auto byteLength = dv->ByteLength();
  auto mem = GetArrayBufferMemory(call, buffer);
  mem.bytes += byteOffset;
  mem.len = byteLength;
  return mem;
}

static bool IsMisaligned(Memory memory,
                         uint8_t ptr_align) {
  auto address = reinterpret_cast<size_t>(memory.bytes);
  size_t mask = (1 << ptr_align) - 1;
  return (address & mask) != 0;
}

static Memory GetAlignedBufferMemory(Call* call,
                                     Local<ArrayBuffer> buffer,
                                     uint8_t ptr_align) {
  auto mem = GetArrayBufferMemory(call, buffer);
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
  *dest = GetAlignedBufferMemory(call, buffer, ptr_align);
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
        auto mem = GetAlignedBufferMemory(call, buffer, ptr_align);
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
                        MemoryAttributes attributes,
                        Memory* dest) {
  auto isolate = call->isolate;
  auto context = call->context;
  Local<Value> value;
  if (!object->Get(context, call->symbol_memory).ToLocal(&value) || !value->IsDataView()) {
    return Result::Failure;
  }
  auto dv = value.As<DataView>();
  auto mem = GetDataViewMemory(call, dv);
  if (call->function_data->attributes.has_pointer) {
    Local<Value> shadow_view;
    bool aliasing = false;
    // see if the data view overlaps another that we've seen earlier
    auto array = call->buffer_map->AsArray();
    auto value = call->buffer_map->Get(context, dv).ToLocalChecked();
    if (value->IsUndefined()) {
      for (size_t i = 0; i < array->Length(); i += 2) {
        auto prev_dv = array->Get(context, i).ToLocalChecked().As<DataView>();
        if (prev_dv->Buffer() == dv->Buffer()) {
          auto prev_mem = GetDataViewMemory(call, prev_dv);
          if (prev_mem.bytes <= mem.bytes && mem.bytes + mem.len <= prev_mem.bytes + prev_mem.len) {
            // previous data view contains this one
            auto prev_value = array->Get(context, i + 1).ToLocalChecked();
            if (prev_value->IsArrayBuffer()) {
              // previous view is being shadowed, use memory from the shadow buffer
              auto shadow_buffer = prev_value.As<ArrayBuffer>();
              auto shadow_mem = GetArrayBufferMemory(call, shadow_buffer);
              size_t offset = prev_mem.bytes - mem.bytes;
              mem.bytes = shadow_mem.bytes + offset;
              shadow_view = DataView::New(shadow_buffer, offset, mem.len);
            }
            aliasing = true;
            break;
          } else if (prev_mem.bytes >= mem.bytes + prev_mem.len || mem.bytes >= prev_mem.bytes + prev_mem.len) {
            // no overlap
          } else {
            // overlaping
            return Result::Failure;
          }
        }
      }
    } else if (value->IsArrayBuffer()) {
      mem = GetArrayBufferMemory(call, value.As<ArrayBuffer>());
    } else if (value->IsDataView()) {
      mem = GetDataViewMemory(call, value.As<DataView>());
    }
    if (value->IsUndefined()) {
      // add data view to map
      if (IsMisaligned(mem, attributes.ptr_align)) {
        // memory is misaligned, need to create a shadow buffer for it
        if (aliasing) {
          // can't create a shadow when another pointer is aliasing this one
          return Result::Failure;
        }
        auto shadow_buffer = ArrayBuffer::New(isolate, dv->ByteLength() + GetExtraCount(attributes.ptr_align));
        shadow_buffer->Set(context, 0, Boolean::New(isolate, attributes.is_const)).Check();
        shadow_buffer->Set(context, 1, Int32::New(isolate, attributes.ptr_align)).Check();
        auto dest_mem = GetAlignedBufferMemory(call, shadow_buffer, attributes.ptr_align);
        memcpy(dest_mem.bytes, mem.bytes, mem.len);
        mem = dest_mem;
        value = shadow_buffer;
      } else if (!shadow_view.IsEmpty()) {
        value = shadow_view;
      } else {
        value = Null(isolate);
      }
      call->buffer_map->Set(context, dv, value).ToLocalChecked();
    }
    *dest = mem;
  } else {
    // just get the memory of argument struct
    *dest = GetDataViewMemory(call, dv);
  }
  return Result::OK;
}

static Result UnshadowMemory(Call* call) {
  auto context = call->context;
  auto array = call->buffer_map->AsArray();
  for (size_t i = 0; i < array->Length(); i += 2) {
    auto value = array->Get(context, i + 1).ToLocalChecked();
    if (value->IsArrayBuffer()) {
      auto shadow_buffer = value.As<ArrayBuffer>();
      auto is_const = static_cast<uint8_t>(shadow_buffer->Get(context, 0).ToLocalChecked().As<Boolean>()->Value());
      if (!is_const) {
        // need to copy data back into view
        auto dv = array->Get(context, i).ToLocalChecked().As<DataView>();
        auto ptr_align = static_cast<uint8_t>(shadow_buffer->Get(context, 1).ToLocalChecked().As<Int32>()->Value());
        auto mem = GetAlignedBufferMemory(call, shadow_buffer, ptr_align);
        auto dest_mem = GetDataViewMemory(call, dv);
        memcpy(dest_mem.bytes, mem.bytes, mem.len);
      }
    }
  }
  return Result::OK;
}

static Result ObtainDataViewFromPool(Call* call,
                                     const Memory& memory,
                                     Local<DataView> *dest) {
  if (!call->mem_pool.IsEmpty()) {
    auto context = call->context;
    for (uint32_t i = 0; i < call->mem_pool->Length(); i++) {
      auto item = call->mem_pool->Get(context, i).ToLocalChecked();
      if (item->IsArrayBuffer()) {
        auto buffer = item.As<ArrayBuffer>();
        if (buffer->ByteLength() >= memory.len) {
          auto pool_mem = GetArrayBufferMemory(call, buffer);
          if (pool_mem.bytes <= memory.bytes && memory.bytes + memory.len <= pool_mem.bytes + pool_mem.len) {
            size_t offset = memory.bytes - pool_mem.bytes;
            *dest = DataView::New(buffer, offset, memory.len);
            return Result::OK;
          }
        }
      }
    }
  }
  return Result::Failure;
}

static Result ObtainDataViewFromMap(Call* call,
                                    const Memory& memory,
                                    Local<DataView> *dest) {
  if (!call->buffer_map.IsEmpty()) {
    auto context = call->context;
    auto array = call->buffer_map->AsArray();
    for (uint32_t i = 0; i < array->Length(); i += 2) {
      auto dv = array->Get(context, i).ToLocalChecked().As<DataView>();
      auto value = array->Get(context, i + 1).ToLocalChecked();
      Memory arg_mem;
      if (value->IsArrayBuffer()) {
        // from shadow buffer
        arg_mem = GetArrayBufferMemory(call, value.As<ArrayBuffer>());
      } else {
        arg_mem = GetDataViewMemory(call, dv);
      }
      if (arg_mem.bytes <= memory.bytes && memory.bytes + memory.len <= arg_mem.bytes + arg_mem.len) {
        if (memory.len == arg_mem.len) {
          *dest = dv;
        } else {
          size_t offset = dv->ByteOffset() + (memory.bytes - arg_mem.bytes);
          *dest = DataView::New(dv->Buffer(), offset, memory.len);
        }
        return Result::OK;
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
    if (ObtainDataViewFromPool(call, memory, dest) == Result::OK) {
      return Result::OK;
    }
    // see if it's from arguments
    if (ObtainDataViewFromMap(call, memory, dest) == Result::OK) {
      return Result::OK;
    }
  }
  // mystery memory, create a shared buffer
  // create a reference to the module so that the shared library doesn't get unloaded
  // while the shared buffer is still around pointing to it
  auto context = call->context;
  auto mde = Local<External>::New(isolate, call->function_data->module_data);
  auto emd = new ExternalMemoryData(isolate, mde);
  std::shared_ptr<BackingStore> store = SharedArrayBuffer::NewBackingStore(memory.bytes, memory.len,
    [](void*, size_t, void* deleter_data) {
      // get rid of the reference
      auto emd = reinterpret_cast<ExternalMemoryData*>(deleter_data);
      delete emd;
    }, emd);
  auto shared_buffer = SharedArrayBuffer::New(isolate, store);
  // save address and len in separate object to enable the freeing of memory
  auto address = reinterpret_cast<size_t>(memory.bytes);
  auto source = Object::New(isolate);
  auto address_name = String::NewFromUtf8Literal(isolate, "address");
  auto len_name = String::NewFromUtf8Literal(isolate, "len");
  source->Set(context, address_name, BigInt::NewFromUnsigned(isolate, address)).Check();
  source->Set(context, len_name, BigInt::NewFromUnsigned(isolate, memory.len)).Check();
  shared_buffer->Set(context, call->symbol_memory, source).Check();
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
                                Thunk thunk,
                                MethodAttributes attributes) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto module_data = Local<External>::New(isolate, call->function_data->module_data);
  auto fd = new FunctionData(isolate, thunk, attributes, module_data);
  auto fde = Local<External>::New(isolate, fd->external);
  return Function::New(context, [](const FunctionCallbackInfo<Value>& info) {
    // Call will extract the FunctionData object created above from the External object
    // which we get from FunctionCallbackInfo::Data()
    Call ctx(info);
    const char* err = ctx.function_data->thunk(&ctx, ctx.argument);
    if (err) {
      auto message = String::NewFromUtf8(ctx.isolate, err).ToLocalChecked();
      info.GetReturnValue().Set(message);
      return;
    }
    if (ctx.function_data->attributes.has_pointer) {
      UnshadowMemory(&ctx);
    }
  }, fde, 3).ToLocalChecked();
}

static Local<Object> NewMethod(Call* call,
                               const Method &m) {
  auto isolate = call->isolate;
  auto context = call->context;
  auto thunk = NewThunk(call, m.thunk, m.attributes);
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
  auto little_endian = Boolean::New(isolate, module->attributes.little_endian);
  auto runtime_safety = Boolean::New(isolate, module->attributes.runtime_safety);
  options->Set(context, String::NewFromUtf8Literal(isolate, "littleEndian"), little_endian).Check();
  options->Set(context, String::NewFromUtf8Literal(isolate, "runtimeSafety"), runtime_safety).Check();
  auto md = new ModuleData(isolate, handle, options, info.Data().As<External>());

  // invoke the factory thunk through JavaScript, which will give us the
  // needed symbols and slots
  Call ctx(isolate, Local<External>::New(isolate, md->external));
  auto factory = NewThunk(&ctx, module->factory, MethodAttributes{ .has_pointer = false });
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
