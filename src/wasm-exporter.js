import { MEMORY, SLOTS, ZIG } from './symbol.js';
import { beginStructure, attachMember, attachMethod, attachTemplate } from './structure.js';
import { decamelizeErrorName } from './error.js';
import { getMemoryCopier } from './memory.js';

const LINKAGE = Symbol('linking');
const DEPENDENCY = Symbol('dependency');

export async function runExporter(wasmBinary) {
  let nextValueIndex = 1;
  const valueTable = { 0: null };
  const valueIndices = new WeakMap();
  let nextStringIndex = 1;
  const stringTable = { 0: null };
  const stringIndices = {};
  const globalSlots = {};
  const memoryTokens = {};
  const memoryRegistry = new FinalizationRegistry((address) => {
    memoryTokens[address] = undefined;
    free(address);
  });
  const decoder = new TextDecoder();
  let nextCallId = 1;
  const callContexts = {};
  const imports = {
    _allocMemory,
    _freeMemory,
    _getMemory,
    _getMemoryOffset,
    _getMemoryLength,
    _wrapMemory,
    _createString,
    _createObject,
    _setObjectPropertyString,
    _setObjectPropertyInteger,
    _setObjectPropertyBoolean,
    _setObjectPropertyObject,
    _getPointerStatus,
    _setPointerStatus,
    _readGlobalSlot,
    _writeGlobalSlot,
    _readObjectSlot,
    _writeObjectSlot,
    _beginStructure,
    _attachMember,
    _attachMethod,
    _attachTemplate,
    _finalizeStructure,
    _createDataView,
    _createTemplate,
    _createArray,
    _appendArray,
    _logValues,
  };
  const { instance } = await WebAssembly.instantiate(wasmBinary, { env: imports });
  const { memory, run, alloc, free } = instance.exports;
  const { buffer } = memory;
  invokeFactory(run);

  function invokeFactory(f) {
    const callId = startCall();
    const argStructIndex = addObject({ [SLOTS]: {} });
    const errorIndex = f(callId, argStructIndex);
    finalizeCall(callId);
    if (errorIndex !== 0) {
      const errorName = stringTable[errorIndex];
      const errorMsg = decamelizeErrorName(errorName);
      throw new Error(errorMsg);
    }
  }

  function startCall() {
    const callId = nextCallId++;
    callContexts[callId] = { memoryPool: null, bufferMap: null };
    return callId;
  }

  function finalizeCall() {
    delete callContext[callId];
    if (Object.keys(callContext) === 0) {
      nextCallId = 1;
    }
  }

  function obtainDataView(ctx, address, size, onStack) {
    if (onStack) {
      // move data from stack onto the heap
      const src = new DataView(buffer, address, size);
      const heapAddress = alloc(size);
      const dv = new DataView(buffer, heapAddress, size);
      const copy = getMemoryCopier(size);
      copy(dv, src);
      memoryRegistry.register(dv, address);
      return dv;
    }
    if (ctx.memoryPool) {
      let src = ctx.memoryPool[address];
      if (!src) {
        for (const [ viewAddr, view ] of Object.entries(ctx.memoryPool)) {
          if (address >= viewAddr && address + size <= viewAddr + view.byteLength) {
            src = view;
            break;
          }
        }
      }
      if (src) {
        if (src.byteLength === size) {
          // just use the view found
          return src;
        } else {
          // create a new view and add a ref to the source so it doesn't get free prematurely
          const newDV = new DataView(buffer, address, size);
          newDV[DEPENDENCY] = src;
          return newDV;
        }
      }
    }

  }

  function _allocMemory(callId, size) {
    const address = alloc(size);
    const dv = new DataView(buffer, address, size);
    // free the memory when the dataview is gc'ed
    const token = memoryRegistry.register(dv, address);
    // same the token so we can unregister
    memoryTokens[address] = token;
    // place dataview into the current call's memory pool
    const ctx = callContexts[callId];
    if (!ctx.memoryPool) {
      ctx.memoryPool = {};
    }
    ctx.memoryPool[address] = dv;
    return address;
  }

  function _freeMemory(callId, address) {
    free(address);
    const token = memoryTokens[address];
    if (token !== undefined) {
      memoryRegistry.unregister(token);
    }
    const ctx = callContexts[callId];
    if (ctx.memoryPool) {
      delete ctx.memoryPool[address];
    }
  }

  function _getMemory(callId, objectIndex) {
    const object = valueTable[objectIndex];
    let dv = object[MEMORY];
    if (!dv) {
      return 0;
    }
    const ctx = callContexts[callId];
    if (dv.buffer != buffer) {
      // not in WASM memory--need to copy
      let buf = ctx.bufferMap?.get(dv.buffer);
      if (!buf) {
        const size = dv.buffer.byteLength;
        const address = alloc(size);
        buf = new DataView(buffer, address, size);
        const src = (dv.byteLength === size) ? dv : new DataView(dv.buffer);
        const copy = getMemoryCopier(size);
        copy(buf, src);
        if (!ctx.bufferMap) {
          ctx.bufferMap = new Map();
        }
        ctx.bufferMap.set(dv.buffer, buf);
      }
    }
    return addObject(dv);
  }

  function _getMemoryOffset(objectIndex) {
    const object = valueTable[objectIndex];
    return object.byteOffset;
  }

  function _getMemoryLength(objectIndex) {
    const object = valueTable[objectIndex];
    return object.byteLength;
  }

  function _wrapMemory(callId, structureIndex, address, len, onStack) {
    const ctx = callContexts[callId];
    const structure = valueTable[structureIndex];
    const dv = obtainDataView(ctx, address, len, onStack);

  }

  function addString(address, len) {
    const ta = new Uint8Array(buffer, address, len);
    const s = decoder.decode(ta);
    let index = stringIndices[s];
    if (index === undefined) {
      index = stringIndices[s] = nextStringIndex++;
      stringTable[index] = s;
    }
    return index;
  }

  function _createString(address, len) {
    return addString(address, len);
  }

  function addObject(object) {
    const index = nextValueIndex++;
    valueTable[index] = object;
    valueIndices.set(object, index);
    return index;
  }

  function _createObject() {
    return addObject({});
  }

  function _setObjectPropertyString(containerIndex, keyIndex, valueIndex) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    const value = stringTable[valueIndex];
    container[key] = value;
  }

  function _setObjectPropertyInteger(containerIndex, keyIndex, value) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    container[key] = value;
  }

  function _setObjectPropertyBoolean(containerIndex, keyIndex, value) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    container[key] = !!value;
  }

  function _setObjectPropertyObject(containerIndex, keyIndex, valueIndex) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    container[key] = valueTable[valueIndex];
  }

  function _getPointerStatus(objectIndex) {
    const pointer = valueTable[objectIndex];
    const status = pointer[ZIG];
    if (typeof(status) !== 'boolean') {
      return -1;
    }
    return status ? 0 : 1;
  }

  function _setPointerStatus(objectIndex, status) {
    const pointer = valueTable[objectIndex];
    pointer[ZIG] = !!status;
  }

  function _readGlobalSlot(slot) {
    const object = globalSlots[slot];
    return object ? valueIndices.get(object) : 0;
  }

  function _writeGlobalSlot(slot, valueIndex) {
    globalSlots[slot] = valueTable[valueIndex];
  }

  function _readObjectSlot(objectIndex, slot) {
    const object = valueTable[objectIndex];
    const value = object[SLOTS][slot];
    return value ? valueIndices.get(value) : 0;
  }

  function _writeObjectSlot(objectIndex, slot, valueIndex) {
    const object = valueTable[objectIndex];
    object[SLOTS][slot] = valueTable[valueIndex];
  }

  function _beginStructure(defIndex) {
    const def = valueTable[defIndex];
    console.log(def);
    return addObject(beginStructure(def));
  }

  function _attachMember(structureIndex, defIndex) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMember(structure, def);
  }

  function _attachMethod(structureIndex, defIndex) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMethod(structure, def);
  }

  function _attachTemplate(structureIndex, defIndex) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachTemplate(structure, def);
  }

  function _finalizeStructure(structureIndex) {

  }

  function _createDataView(address, len, copying) {
    const copy = getMemoryCopier(len);
    const src = new DataView(buffer, address, len);
    const dest = new DataView(new ArrayBuffer(len));
    copy(dest, src);
    if (!copying) {
      // TODO
      dest[LINKAGE] = 0;
    }
    return addObject(dest);
  }

  function _createTemplate(memoryIndex) {
    const memory = valueTable[memoryIndex];
    return addObject({
      [MEMORY]: memory,
      [SLOTS]: {},
    });
  }

  function _createArray() {
    return addObject([]);
  }

  function _appendArray(arrayIndex, valueIndex) {
    const array = valueTable[arrayIndex];
    const value = valueTable[valueIndex];
    return array.push(value);
  }

  function _logValues(arrayIndex) {
    const array = valueTable[arrayIndex];
    console.log(...array);
  }
}

