import { MEMORY, SLOTS, ZIG, SOURCE } from './symbol.js';
import {
  StructureType,
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
  getStructureFeature,
} from './structure.js';
import { MemberType, getMemberFeature } from './member.js';
import { decamelizeErrorName } from './error.js';
import { getMemoryCopier } from './memory.js';

process.env.NODE_ZIG_TARGET = 'WASM-STAGE1';

export function linkWASMBinary(binaryPromise, globalSlots, linkages) {
  const initPromise = binaryPromise.then((wasmBinary) => {
    return runWASMBinary(wasmBinary, globalSlots, linkages);
  });
  // TODO: hook methods to promise
  return initPromise;
}

export async function runWASMBinary(wasmBinary, globalSlots, linkages) {
  let nextValueIndex = 1;
  const valueTable = { 0: null };
  const valueIndices = new WeakMap();
  let nextStringIndex = 1;
  const stringTable = { 0: null };
  const stringIndices = {};
  const decoder = new TextDecoder();
  let nextCallId = 1;
  const callContexts = {};
  let methodCount = 0, structureCount = 0;
  let nextLinkageIndex = 0;
  let nextMethodIndex = 0;
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
  const { memory: wasmMemory, init, run, get, alloc, free } = instance.exports;
  if (process.env.NODE_ZIG_TARGET === 'WASM-STAGE1') {
    init();
    invokeFactory(run);
    return { methodCount, structureCount };
  } else if (process.env.NODE_ZIG_TARGET === 'WASM-STAGE2') {
    init();
  } else {
    throw new Error(`The environment variable NODE_ZIG_TARGET must be "WASM-STAGE1" or "WASM-STAGE2"`);
  }

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
    callContexts[callId] = { memoryPool: null, bufferMap: new Map() };
    return callId;
  }

  function finalizeCall(callId) {
    delete callContexts[callId];
    if (Object.keys(callContexts) === 0) {
      nextCallId = 1;
    }
  }

  function obtainDataView(ctx, address, len, onStack) {
    if (!onStack) {
      for (const [ buffer, memory ] of ctx.bufferMap) {
        if (memory.address <= address && address + len <= memory.address + memory.len) {
          const offset = address - memory.address;
          return new DataView(buffer, offset, len);
        }
      }
    }
    const src = new DataView(wasmMemory.buffer, address, len);
    if (onStack || process.env.NODE_ZIG_TARGET === 'WASM-STAGE1') {
      const buffer = new ArrayBuffer(len);
      const dest = new DataView(buffer);
      const copy = getMemoryCopier(len);
      copy(dest, src);
      if (!onStack) {
        // flag the need for linkage
        dest.linkage = nextLinkageIndex++;
      }
      return dest;
    } else {
      // mystery memory--link directly to it, providing the memory object
      // so we can recreate the view in the event of buffer deattachment
      // due to address space enlargement
      src[SOURCE] = wasmMemory;
      return src;
    }
  }

  function _allocMemory(callId, len) {
    const address = alloc(len);
    const ctx = callContexts[callId];
    if (!ctx.memoryPool) {
      ctx.memoryPool = [];
    }
    const memory = { address, len };
    ctx.memoryPool.push(memory);
    const buffer = new ArrayBuffer(len);
    ctx.bufferMap.set(buffer, address);
    return address;
  }

  function _freeMemory(callId, address) {
    const ctx = callContexts[callId];
    const index = ctx.memoryPool.findIndex(m => m.address === address);
    if (index !== -1) {
      ctx.memoryPool.splice(index, 1);
    }
    free(address);
  }

  function _getMemory(callId, objectIndex) {
    const object = valueTable[objectIndex];
    let dv = object[MEMORY];
    if (!dv) {
      return 0;
    }
    const ctx = callContexts[callId];
    let memory = ctx.bufferMap.get(dv.buffer);
    if (!memory) {
      const len = dv.buffer.byteLength;
      const address = alloc(len);
      const dest = new DataView(memory.buffer, address, len);
      // create new dataview if one given only covers a portion of it
      const src = (dv.byteLength === len) ? dv : new DataView(dv.buffer);
      const copy = getMemoryCopier(size);
      copy(dest, src);
      memory = { address, len };
      ctx.bufferMap.set(dv.buffer, memory);
    }
    return addObject({
      address: memory.address + dv.byteOffset,
      len: dv.byteLength
    });
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
    const dv = valueTable[viewIndex];
    let object;
    if (process.env.NODE_ZIG_TARGET === 'WASM-STAGE1') {
      object = { structure, memory: dv };
    } else {
      const { constructor } = structure;
      object = constructor.call(ZIG, dv);
    }
    return addObject(object);
  }

  function addString(address, len) {
    const ta = new Uint8Array(wasmMemory.buffer, address, len);
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
    if (process.env.NODE_ZIG_TARGET === 'WASM-STAGE1') {
      // while we're defining structures in stage 1, we don't have any actual pointers
      // just tell exporter.zig that the "pointers" don't belong to it so dezigStructure()
      // thinks that what it needs to do has happened already
      return 0;
    } else {
      const pointer = valueTable[objectIndex];
      const status = pointer[ZIG];
      if (typeof(status) !== 'boolean') {
        return -1;
      }
      return status ? 0 : 1;
    }
  }

  function _setPointerStatus(objectIndex, status) {
    if (process.env.NODE_ZIG_TARGET === 'WASM-STAGE1') {
    } else {
      const pointer = valueTable[objectIndex];
      pointer[ZIG] = !!status;
    }
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
    methodCount++;
  }

  function _attachTemplate(structureIndex, defIndex) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachTemplate(structure, def);
  }

  function _finalizeStructure(structureIndex) {
    // do nothing
    structureCount++;
  }

  function _createDataView(call_id, address, len, onStack) {
    const ctx = callContexts[call_id];
    const dv = obtainDataView(ctx, address, len, !!onStack);
    return addObject(dv);
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

export function serializeDefinitions(slots, wasmbinaryURL) {
  const lines = [];
  function add (s) {
    lines.push(s);
  }
  const structureFeatures = {}, memberFeatures = {};
  for (const [ slot, structure ] of Object.entries(slots)) {
    structureFeatures[getStructureFeature(structure)] = true;
    for (const members of [ structure.instance.members, structure.static.members ]) {
      for (const member of members) {
        memberFeatures[ getMemberFeature(member) ] = true;
      }
    }
  }
  if (memberFeatures.useIntEx) {
    delete memberFeatures.useInt;
  }
  if (memberFeatures.useEnumerationItemEx) {
    delete memberFeatures.useEnumerationItem;
  }
  if (memberFeatures.useFloatEx) {
    delete memberFeatures.useFloat;
  }
  if (memberFeatures.useBoolEx) {
    delete memberFeatures.useBool;
  }
  const features = [ ...Object.keys(structureFeatures), ...Object.keys(memberFeatures) ];
  const imports = [ 'finalizeStructures' ];
  if (wasmbinaryURL) {
    imports.push('linkWASMBinary');
  }
  imports.push(...features);
  add(`import {`);
  for (const name of imports) {
    add(`  ${name},`);
  }
  add(`} from "../../src/wasm-exporter.js";`);

  add(`\n// activate features`);
  for (const feature of features) {
    add(`${feature}();`);
  }

  add(`\n// define structures`);
  const structureNames = new Map();
  for (const [ slot, structure ] of Object.entries(slots)) {
    structureNames.set(structure, `s${slot}`);
  }
  const varnames = [];
  for (const [ slot, structure ] of Object.entries(slots)) {
    const varname = structureNames.get(structure);
    add(`const ${varname} = {`);
    addStructureProperties(structure);
    add(`};`)
    varnames.push(varname);
  }

  add(`\n// finalize structures`);
  if (varnames.length <= 10) {
    add(`const slots = [ ${varnames.join(', ') } ];`);
  } else {
    add(`const slots = [`);
    for (let i = 0; i < varnames.length; i += 10) {
      const slice = varnames.slice(i, i + 10);
      add(`  ${slice.join(', ')},`);
    }
    add(`];`);
  }
  add(`const linkages = finalizeStructures(slots);`);
  add(`const module = ${structureNames.get(slots[0])}.constructor;`);

  if (wasmbinaryURL) {
    add('\n// initialize loading and compilation of WASM bytecodes');
    // TODO: figure out how best to load the binary
    add('const __init = linkWASMBinary(binaryPromise, slots, linkages);');
  } else {
    add('\n// no need to initialize WASM binary');
    add('const __init = Promise.resolve(true);');
  }

  add('\n// export functions, types, and constants');
  const exportables = [];
  for (const method of slots[0].methods) {
    exportables.push(method.name);
  }
  for (const member of slots[0].static.members) {
    let readOnly = false;
    if (member.type === MemberType.Type) {
      readOnly = true;
    } else if (member.type === MemberType.Object && member.structure.type === StructureType.Pointer) {
      if (member.isConst) {
        readOnly = true;
      }
    }
    if (readOnly) {
      exportables.push(member.name);
    }
  }
  add(`const {`);
  for (const name of exportables) {
    add(`  ${name},`);
  }
  add(`} = module;`);
  add(`export {`);
  for (const name of [ 'module as default', ...exportables, '__init' ]) {
    add(`  ${name},`);
  }
  add(`};`);
  add(``);

  function addStructureProperties(structure) {
    for (const [ name, value ] of Object.entries(structure)) {
      switch (name) {
        case 'instance':
        case 'static':
          add(`  ${name}: {`);
          if (value.members.length > 0) {
            add(`    member: [`);
            for (const member of value.members) {
              add(`      {`);
              addMemberProperties(member);
              add(`      },`);
            }
            add(`    ],`)
          } else {
            add(`    member: [],`);
          }
          if (value.template) {
            add(`    template: {`);
            addTemplateProperties(value.template);
            add(`    }  `)
          } else {
            add(`    template: null`);
          }
          add(`  },`);
          break;
        default:
          add(`  ${name}: ${JSON.stringify(value)},`);
      }
    }
  }

  function addMemberProperties(member) {
    for (const [ name, value ] of Object.entries(member)) {
      switch (name) {
        case 'structure':
          add(`        ${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`        ${name}: ${JSON.stringify(value)},`);
      }
    }
  }

  function addTemplateProperties(template) {
    const { [MEMORY]: dv, [SLOTS]: slots } = template;
    if (dv) {
      const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      add(`      memory: [ ${ta.join(', ')} ],`);
    }
    if (slots) {
      add(`      slots: {`);
      for (const [ slot, object ] of Object.entries(slots)) {
        // note: object is created by _wrapMemory()
        const { memory, structure } = object;
        add(`        ${slot}: {`);
        add(`          structure: ${structureNames.get(structure)},`);
        const ta = new Uint8Array(memory.buffer, memory.byteOffset, memory.byteLength);
        add(`          memory: [ ${ta.join(', ')} ],`);
        if (memory.hasOwnProperty('linkage')) {
          add(`          linkage: ${memory.linkage},`);
        }
        add(`        },`);
      }
      add(`      },`);
    }
  }
  return lines.join('\n');
}

export function finalizeStructures(structures) {
  // first, fix up the structure templates
  const linkages = [];
  for (const s of structures) {
    for (const target of [ s.static, s.instance ]) {
      if (target.template) {
        const { memory, slots } = target.template;
        const template = {};
        if (memory) {
          template[MEMORY] = new DataView(new Uint8Array(memory).buffer);
        }
        if (slots) {
          const objects = {};
          for (const [ slot, { structure, memory, linkage } ] of slots) {
            const constructor = structure.constructor ?? finalizeStructure(structure);
            const dv = new DataView(new Uint8Array(memory).buffer);
            const object = constructor.call(null, dv);
            objects[slot] = object;
            if (linkage !== undefined) {
              // need to replace dataview with one pointing to WASM memory later,
              // once the VM is up and running
              linkages[linkage] = object;
            }
          }
          template[SLOTS] = objects;
        }
        target.template = template;
      }
    }
  }
  for (const s of structures) {
    if (!s.constructor) {
      finalizeStructure(s);
    }
  }
  return linkages;
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
  useOpaque,
  useArgStruct,
} from './structure.js';
export {
  useVoid,
  useBool,
  useBoolEx,
  useInt,
  useIntEx,
  useFloat,
  useFloatEx,
  useEnumerationItem,
  useEnumerationItemEx,
  useObject,
} from './member.js';
