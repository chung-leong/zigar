import { MEMORY, SLOTS, ZIG, STRUCTURE } from './symbol.js';
import {
  StructureType,
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
} from './structure.js';
import { decamelizeErrorName } from './error.js';
import { initializeErrorSets } from './error-set.js';
import { getMemoryCopier } from './memory.js';

const MemoryDisposition = {
  Auto: 0,
  Copy: 1,
  Link: 2,
};

export async function linkModule(sourcePromise, params = {}) {
  const {
    resolve,
    reject,
    promise,
    ...linkParams
  } = params;
  try {
    const source = await sourcePromise;
    const result = await runModule(source, linkParams);
    resolve(result);
  } catch (err) {
    reject(err);
  }
  return promise;
}

export async function runModule(source, options = {}) {
  const {
    omitFunctions = false,
    slots = {},
    variables,
    methodRunner,
    writeBack = true,
  } = options;
  let nextValueIndex = 0;
  let valueTable = null;
  let valueIndices = null;
  let nextStringIndex = 0;
  let stringTable = null;
  let stringIndices = null;
  const decoder = new TextDecoder();
  const callContexts = {};
  let callContextCount = 0;
  const globalSlots = slots;
  const structures = [];
  const empty = () => {};
  const imports = {
    _startCall,
    _endCall,
    _allocMemory,
    _freeMemory,
    _getMemory,
    _getMemoryOffset,
    _getMemoryLength,
    _wrapMemory,
    _createString,
    _getPointerStatus,
    _setPointerStatus,
    _readGlobalSlot,
    _readObjectSlot,
    _writeObjectSlot,
    _createDataView,
    _writeToConsole,

    // these functions will only be called at comptime
    _writeGlobalSlot: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _writeGlobalSlot : empty,
    _setObjectPropertyString: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _setObjectPropertyString : empty,
    _setObjectPropertyInteger: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _setObjectPropertyInteger : empty,
    _setObjectPropertyBoolean: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _setObjectPropertyBoolean : empty,
    _setObjectPropertyObject: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _setObjectPropertyObject : empty,
    _beginStructure: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _beginStructure : empty,
    _attachMember: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _attachMember : empty,
    _attachMethod: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _attachMethod : empty,
    _attachTemplate: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _attachTemplate : empty,
    _finalizeStructure: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _finalizeStructure : empty,
    _createObject: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _createObject : empty,
    _createTemplate: (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') ? _createTemplate : empty,
  };
  const importObject = { env: imports };
  const promise = (source[Symbol.toStringTag] === 'Response')
    ? WebAssembly.instantiateStreaming(source, importObject)
    : WebAssembly.instantiate(source, importObject);
  let { instance } = await promise;
  let { memory: wasmMemory, define, run, alloc, free, safe } = instance.exports;
  let consolePending = '', consoleTimeout = 0;
  resetTables();

  if (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') {
    // call factory function
    const runtimeSafety = !!safe();
    const argStructIndex = addObject({ [SLOTS]: {} });
    const errorIndex = define(argStructIndex);
    if (errorIndex !== 0) {
      throwError(errorIndex);
    }
    return { structures, runtimeSafety };
  } else if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
    // link variables
    for (const { address, object } of variables) {
      linkObject(object, Number(address));
    }
    // link methods
    methodRunner[0] = function(thunkIndex, argStruct) {
      const argIndex = addObject(argStruct);
      const errorIndex = run(argIndex, thunkIndex);
      if (errorIndex !== 0) {
        throwError(errorIndex);
      }
    };
    const weakRef = new WeakRef(instance);
    const abandon = () => {
      instance = wasmMemory = define = alloc = free = safe = null;
      run = function() {
        throw new Error('WebAssembly instance was abandoned');
      };
      for (const { object } of variables) {
        unlinkObject(object);
      }
    };
    const released = () => {
      return !weakRef.deref();
    };
    return { abandon, released };
  } else {
    throw new Error(`The environment variable ZIGAR_TARGET must be "WASM-COMPTIME" or "WASM-RUNTIME"`);
  }

  function resetTables() {
    if (nextValueIndex !== 1) {
      nextValueIndex = 1;
      valueTable = { 0: null };
      valueIndices = new WeakMap();
    }
    if (nextStringIndex !== 1) {
      nextStringIndex = 1;
      stringTable = { 0: null };
      stringIndices = {};
    }
  }

  function getString(address, len) {
    const ta = new Uint8Array(wasmMemory.buffer, address, len);
    return decoder.decode(ta);
  }

  function addString(address, len) {
    const s = getString(address, len);
    let index = stringIndices[s];
    if (index === undefined) {
      index = stringIndices[s] = nextStringIndex++;
      stringTable[index] = s;
    }
    return index;
  }

  function addObject(object) {
    const index = nextValueIndex++;
    valueTable[index] = object;
    valueIndices.set(object, index);
    return index;
  }

  function getObjectIndex(object) {
    const index = valueIndices.get(object);
    return (index !== undefined) ? index : addObject(object);
  }

  function linkObject(object, address) {
    const dv1 = object[MEMORY];
    const len = dv1.byteLength;
    if (len === 0) {
      return;
    }
    const dv2 = new DataView(wasmMemory.buffer, address, len);
    if (writeBack) {
      const copy = getMemoryCopier(dv1.byteLength);
      copy(dv2, dv1);
    }
    dv2[MEMORY] = { memory: wasmMemory, address, len };
    object[MEMORY] = dv2;
    if (object.hasOwnProperty(ZIG)) {
      // a pointer--link the target too
      const targetObject = object[SLOTS][0];
      const targetAddress = dv2.getUint32(0, true);
      linkObject(targetObject, targetAddress);
    }
  }

  function unlinkObject(object) {
    const dv1 = object[MEMORY];
    const len = dv1.byteLength;
    if (len === 0 || !dv1[MEMORY]) {
      return;
    }
    const dv2 = new DataView(new ArrayBuffer(len));
    const copy = getMemoryCopier(dv1.byteLength);
    copy(dv2, dv1);
    object[MEMORY] = dv2;
    if (object.hasOwnProperty(ZIG)) {
      // a pointer--unlink the target too
      const targetObject = object[SLOTS][0];
      unlinkObject(targetObject);
    }
  }

  function throwError(errorIndex) {
    const errorName = stringTable[errorIndex];
    const errorMsg = decamelizeErrorName(errorName);
    throw new Error(errorMsg);
  }

  function _startCall(ctxAddr) {
    callContexts[ctxAddr] = { bufferMap: new Map() };
    callContextCount++;
  }

  function _endCall(ctxAddr) {
    // move data from WASM memory into buffers
    const ctx = callContexts[ctxAddr];
    for (const [ dest, { address, len, ptrAlign, copy, shadow } ] of ctx.bufferMap) {
      if (copy) {
        const src = new DataView(wasmMemory.buffer, address, len);
        copy(dest, src);
      }
      if (shadow) {
        free(ctxAddr, address, len, ptrAlign);
      }
    }
    delete callContexts[ctxAddr];
    callContextCount--;
    if (callContextCount === 0) {
      // clear the value tables
      resetTables();
      // output pending text to console
      if (consolePending) {
        console.log(consolePending);
        consolePending = '';
        clearTimeout(consoleTimeout);
      }
    }
  }

  function _allocMemory(ctxAddr, len, ptrAlign) {
    if (len === 0) {
      return null;
    }
    const address = alloc(ctxAddr, len, ptrAlign);
    const { bufferMap } = callContexts[ctxAddr];
    const buffer = new ArrayBuffer(len);
    const dv = new DataView(buffer);
    const copy = getMemoryCopier(len);
    const src = new DataView(wasmMemory.buffer, address, len);
    bufferMap.set(dv, { address, len, ptrAlign, copy, shadow: true });
    return address;
  }

  function _freeMemory(ctxAddr, address, len, ptrAlign) {
    const { bufferMap } = callContexts[ctxAddr];
    for (const [ dv, { address: matching } ] of bufferMap) {
      if (address === matching) {
        bufferMap.delete(dv);
        free(ctxAddr, address, len, ptrAlign);
      }
    }
  }

  function isMisaligned({ address }, ptrAlign) {
    const mask = (1 << ptrAlign) - 1;
    return (address & mask) !== 0;
  }

  function _getMemory(ctxAddr, objectIndex, ptrAlign, isConst) {
    const object = valueTable[objectIndex];
    let dv = object[MEMORY];
    if (!dv) {
      return 0;
    }
    const source = dv[MEMORY];
    if (source) {
      return addObject(source);
    } else {
      const ctx = callContexts[ctxAddr];
      let memory = ctx.bufferMap.get(dv);
      if (!memory) {
        // see if memory overlaps another data view seen earlier
        const len = dv.byteLength;
        if (len === 0) {
          return addObject({ address: 0, len: 0 });
        }
        for (const [ prevDV, prevMemory ] of ctx.bufferMap) {
          if (dv.buffer === prevDV.buffer) {
            if (prevDV.byteOffset <= dv.byteOffset && dv.byteOffset + len <= prevDV.byteOffset + prevDV.byteLength) {
              const address = prevMemory.address + (dv.byteOffset - prevDV.byteOffset);
              memory = { address, len, copy: null, ptrAlign, shadow: false };
              break;
            } else if (prevDV.byteOffset >= dv.byteOffset + len || dv.byteOffset >= prevDV.byteOffset + prevDV.byteLength) {
              // no overlap
            } else {
              // overlapping
              return 0;
            }
          }
        }
        if (memory) {
          if (isMisaligned(memory, ptrAlign)) {
            return 0;
          }
        } else {
          const address = alloc(ctxAddr, len, ptrAlign);
          const dest = new DataView(wasmMemory.buffer, address, len);
          // create new dataview if the one given only covers a portion of it
          const src = (dv.byteLength === len) ? dv : new DataView(dv.buffer);
          const copy = getMemoryCopier(len);
          copy(dest, src);
          memory = { address, len, copy: (isConst) ? null : copy, ptrAlign, shadow: true };
        }
        ctx.bufferMap.set(dv, memory);
      }
      return addObject(memory);
    }
  }

  function _getMemoryOffset(objectIndex) {
    const object = valueTable[objectIndex];
    return object.address;
  }

  function _getMemoryLength(objectIndex) {
    const object = valueTable[objectIndex];
    return object.len;
  }

  function _wrapMemory(structureIndex, viewIndex) {
    const structure = valueTable[structureIndex];
    let dv = valueTable[viewIndex];
    let object;
    if (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') {
      object = {
        [STRUCTURE]: structure,
        [MEMORY]: dv,
        [SLOTS]: {},
      };
      if (structure.type === StructureType.Pointer) {
        object[ZIG] = true;
      }
    } else {
      const { constructor } = structure;
      object = constructor.call(ZIG, dv);
    }
    return addObject(object);
  }

  function _createString(address, len) {
    return addString(address, len);
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
    return status ? 1 : 0;
  }

  function _setPointerStatus(objectIndex, status) {
    const pointer = valueTable[objectIndex];
    pointer[ZIG] = !!status;
  }

  function _readGlobalSlot(slot) {
    const object = globalSlots[slot];
    return object ? getObjectIndex(object) : 0;
  }

  function _writeGlobalSlot(slot, valueIndex) {
    const value = valueTable[valueIndex];
    globalSlots[slot] = value;
    // remember the slot number of each structure defined
    value.slot = slot;
  }

  function _readObjectSlot(objectIndex, slot) {
    const object = valueTable[objectIndex];
    const value = object[SLOTS][slot];
    return value ? getObjectIndex(value) : 0;
  }

  function _writeObjectSlot(objectIndex, slot, valueIndex) {
    const object = valueTable[objectIndex];
    object[SLOTS][slot] = valueTable[valueIndex];
  }

  function _beginStructure(defIndex) {
    const def = valueTable[defIndex];
    return addObject(beginStructure(def));
  }

  function _attachMember(structureIndex, defIndex, isStatic) {
    if (omitFunctions) {
      return;
    }
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMember(structure, def, !!isStatic);
  }

  function _attachMethod(structureIndex, defIndex, isStaticOnly) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMethod(structure, def, !!isStaticOnly);
  }

  function _attachTemplate(structureIndex, templateIndex, isStatic) {
    const structure = valueTable[structureIndex];
    const template = valueTable[templateIndex];
    attachTemplate(structure, template, !!isStatic);
  }

  function _finalizeStructure(structureIndex) {
    const structure = valueTable[structureIndex];
    structures.push(structure);
  }

  function createCopy(ctx, address, len) {
    const buffer = new ArrayBuffer(len);
    const dv = new DataView(buffer);
    if (len > 0) {
      // copy content immediately, since address is likely pointing to a stack location
      const copy = getMemoryCopier(len);
      const src = new DataView(wasmMemory.buffer, address, len);
      copy(dv, src);
    }
    ctx.bufferMap.set(dv, { address, len, copy: null, ptrAlign: 0, shadow: false });
    return dv;
  }

  function obtainDataView(ctx, address, len, disposition) {
    if (disposition === MemoryDisposition.Copy) {
      return createCopy(ctx, address, len);
    } else if (disposition === MemoryDisposition.Auto) {
      // look for address among existing buffers
      for (const [ dv, { address: start, len: len2 } ] of ctx.bufferMap) {
        if (start <= address && address + len <= start + len2) {
          if (len === len2) {
            return dv;
          } else {
            const offset = address - start;
            return new DataView(dv.buffer, offset, len);
          }
        }
      }
    }
    if (process.env.ZIGAR_TARGET === 'WASM-COMPTIME') {
      const dv = createCopy(ctx, address, len);
      if (disposition !== MemoryDisposition.Copy) {
        // need linkage to wasm memory at runtime
        dv.address = address;
      }
      return dv;
    } else {
      // mystery memory--link directly to it, attaching the memory object
      // so we can recreate the view in the event of buffer deattachment
      // due to address space enlargement
      const dv = new DataView(wasmMemory.buffer, address, len);
      dv[MEMORY] = { memory: wasmMemory, address, len };
      return dv;
    }
  }

  function _createDataView(ctxAddr, address, len, disposition) {
    const ctx = callContexts[ctxAddr];
    return addObject(obtainDataView(ctx, address, len, disposition));
  }

  function _createTemplate(memoryIndex) {
    const memory = valueTable[memoryIndex];
    return addObject({
      [MEMORY]: memory,
      [SLOTS]: {},
    });
  }

  function _writeToConsole(address, len) {
    // send text up to the last newline character
    const s = getString(address, len);
    const index = s.lastIndexOf('\n');
    if (index === -1) {
      consolePending += s;
    } else {
      console.log(consolePending + s.substring(0, index));
      consolePending = s.substring(index + 1);
    }
    clearTimeout(consoleTimeout);
    if (consolePending) {
      consoleTimeout = setTimeout(() => {
        console.log(consolePending);
        consolePending = '';
      }, 250);
    }
  }
}

export function finalizeStructures(structures) {
  const slots = {};
  const variables = [];
  initializeErrorSets();
  for (const structure of structures) {
    for (const target of [ structure.static, structure.instance ]) {
      // first create the actual template using the provided placeholder
      if (target.template) {
        target.template = createTemplate(target.template);
      }
    }
    for (const method of structure.static.methods) {
      // create thunk function
      method.thunk = createThunk(method.thunk);
    }
    finalizeStructure(structure);
    // place structure into its assigned slot
    slots[structure.slot] = structure;
  }

  function createTemplate(placeholder) {
    const template = {};
    if (placeholder.memory) {
      const { array, offset, length } = placeholder.memory;
      template[MEMORY] = new DataView(array.buffer, offset, length);
    }
    if (placeholder.slots) {
      template[SLOTS] = insertObjects({}, placeholder.slots);
    }
    return template;
  }

  function insertObjects(dest, placeholders) {
    for (const [ slot, placeholder ] of Object.entries(placeholders)) {
      dest[slot] = createObject(placeholder);
    }
    return dest;
  }

  function createObject(placeholder) {
    let dv;
    if (placeholder.memory) {
      const { array, offset, length } = placeholder.memory;
      dv = new DataView(array.buffer, offset, length);
    } else {
      const { byteSize } = placeholder.structure;
      dv = new DataView(new ArrayBuffer(byteSize));
    }
    const { constructor } = placeholder.structure;
    const object = constructor.call(ZIG, dv);
    if (placeholder.slots) {
      insertObjects(object[SLOTS], placeholder.slots);
    }
    if (placeholder.address !== undefined) {
      // need to replace dataview with one pointing to WASM memory later,
      // when the VM is up and running
      variables.push({ address: placeholder.address, object });
    }
    return object;
  }

  let resolve, reject;
  const promise = new Promise((r1, r2) => {
    resolve = r1;
    reject = r2;
  });
  const methodRunner = {
    0: function(index, argStruct) {
      // wait for linking to occur, then activate the runner again
      return promise.then(() => methodRunner[0].call(this, index, argStruct));
    },
  };

  function createThunk(index) {
    return function(argStruct) {
      return methodRunner[0](index, argStruct);
    };
  }

  return { promise, resolve, reject, slots, variables, methodRunner };
}

export {
  usePrimitive,
  useArray,
  useStruct,
  useExternUnion,
  useBareUnion,
  useTaggedUnion,
  useErrorUnion,
  useErrorSet,
  useEnumeration,
  useOptional,
  usePointer,
  useSlice,
  useVector,
  useOpaque,
  useArgStruct,
} from './structure.js';
export {
  useVoid,
  useBool,
  useBoolEx,
  useInt,
  useIntEx,
  useUint,
  useUintEx,
  useFloat,
  useFloatEx,
  useEnumerationItem,
  useEnumerationItemEx,
  useObject,
  useType,
} from './member.js';
