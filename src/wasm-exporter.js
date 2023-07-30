import { MEMORY, SLOTS, ZIG, SOURCE, STRUCTURE } from './symbol.js';
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

const MemoryDisposition = {
  Auto: 0,
  Copy: 1,
  Link: 2,
};

export async function linkWASMBinary(binaryPromise, params = {}) {
  const {
    resolve,
    reject,
    promise,
    ...linkParams
  } = params;
  try {
    const wasmBinary = await binaryPromise;
    const result = await runWASMBinary(wasmBinary, linkParams);
    resolve(result);
  } catch (err) {
    reject(err);
  }
  return promise;
}

export async function runWASMBinary(wasmBinary, options = {}) {
  const {
    omitFunctions,
    variables,
    methodRunner,
  } = options;
  let nextValueIndex = 1;
  let valueTable = { 0: null };
  const valueIndices = new WeakMap();
  let nextStringIndex = 1;
  const stringTable = { 0: null };
  const stringIndices = {};
  const decoder = new TextDecoder();
  const callContexts = {};
  const globalSlots = {};
  const structures = [];
  // these functions will only be called at comptime
  const comptimeImports = /*(process.env.NODE_ZIG_TARGET === 'WASM-COMPTIME') &&*/ {
    _readGlobalSlot,
    _writeGlobalSlot,
    _setObjectPropertyString,
    _setObjectPropertyInteger,
    _setObjectPropertyBoolean,
    _setObjectPropertyObject,
    _beginStructure,
    _attachMember,
    _attachMethod,
    _attachTemplate,
    _finalizeStructure,
    _createObject,
    _createTemplate,
  };
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
    _readObjectSlot,
    _writeObjectSlot,
    _createDataView,
    _writeToConsole,
    ...comptimeImports
  };
  const { instance } = await WebAssembly.instantiate(wasmBinary, { env: imports });
  const { memory: wasmMemory, define, run, alloc, free } = instance.exports;
  if (process.env.NODE_ZIG_TARGET === 'WASM-COMPTIME') {
    // call factory function
    const argStructIndex = addObject({ [SLOTS]: {} });
    const errorIndex = define(argStructIndex);
    if (errorIndex !== 0) {
      throwError(errorIndex);
    }
    return structures;
  } else if (process.env.NODE_ZIG_TARGET === 'WASM-RUNTIME') {
    // link variables
    for (const [ address, object ] of Object.entries(variables)) {
      linkObject(object, address);
    }
    // link methods
    methodRunner[0] = function(thunkIndex, argStruct) {
      const argIndex = addObject(argStruct);
      const errorIndex = run(argIndex, thunkIndex);
      if (errorIndex !== 0) {
        throwError(errorIndex);
      }
    };
  } else {
    throw new Error(`The environment variable NODE_ZIG_TARGET must be "WASM-COMPTIME" or "WASM-RUNTIME"`);
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
    const dv2 = new DataView(wasmMemory.buffer, address, len);
    const copy = getMemoryCopier(dv1.byteLength);
    for (const [ index, dv ] of [ dv1, dv2 ].entries()) {
      const array = [];
      for (let i = 0; i < dv.byteLength; i++) {
        array.push(dv.getUint8(i));
      }
    }
    copy(dv2, dv1);
    dv2[SOURCE] = { memory: wasmMemory, address, len };
    Object.defineProperty(object, MEMORY, { value: dv2, configurable: true });
    if (object.hasOwnProperty(ZIG)) {
      // a pointer--link the target too
      // an 8-byte pointer is a "fat pointer", with the length coming first
      const offset = (len === 8) ? 4 : 0;
      const targetAddress = dv2.getUint32(offset, true);
      const targetObject = object[SLOTS][0];
      linkObject(targetObject, targetAddress);
    }
  }

  function throwError(errorIndex) {
    const errorName = stringTable[errorIndex];
    const errorMsg = decamelizeErrorName(errorName);
    throw new Error(errorMsg);
  }

  function _startCall(ctxAddr) {
    callContexts[ctxAddr] = { bufferMap: new Map() };
  }

  function _endCall(ctxAddr) {
    // move data from WASM memory into buffers
    const ctx = callContexts[ctxAddr];
    for (const [ buffer, { address, len, dv, copy } ] of ctx.bufferMap) {
      const src = new DataView(wasmMemory.buffer, address, len);
      copy(dv, src);
    }
    delete callContexts[ctxAddr];
    if (Object.keys(callContexts) === 0) {
      // clear the value table
      nextValueIndex = 1;
      valueTable = { 0: null };
    }
  }

  function _allocMemory(ctxAddr, len) {
    const address = alloc(ctxAddr, len);
    const ctx = callContexts[ctxAddr];
    const buffer = new ArrayBuffer(len);
    const dv = new DataView(buffer);
    const copy = getMemoryCopier(len);
    ctx.bufferMap.set(buffer, { address, len, dv, copy });
    return address;
  }

  function _freeMemory(ctxAddr, address, len) {
    const ctx = callContexts[ctxAddr];
    for (const [ buffer, { address: matching } ] of bufferMap) {
      if (address === matching) {
        bufferMap.delete(buffer);
        free(ctxAddr, address, len);
      }
    }
  }

  function _getMemory(ctxAddr, objectIndex) {
    const object = valueTable[objectIndex];
    let dv = object[MEMORY];
    if (!dv) {
      return 0;
    }
    const ctx = callContexts[ctxAddr];
    let memory = ctx.bufferMap.get(dv.buffer);
    if (!memory) {
      const len = dv.buffer.byteLength;
      const address = alloc(ctxAddr, len);
      const dest = new DataView(wasmMemory.buffer, address, len);
      // create new dataview if the one given only covers a portion of it
      const src = (dv.byteLength === len) ? dv : new DataView(dv.buffer);
      const copy = getMemoryCopier(len);
      copy(dest, src);
      memory = { address, len, dv: src, copy };
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
    if (process.env.NODE_ZIG_TARGET === 'WASM-COMPTIME') {
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
    globalSlots[slot] = valueTable[valueIndex];
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

  function _attachTemplate(structureIndex, templateIndex) {
    const structure = valueTable[structureIndex];
    const template = valueTable[templateIndex];
    attachTemplate(structure, template);
  }

  function _finalizeStructure(structureIndex) {
    const structure = valueTable[structureIndex];
    structures.push(structure);
  }

  function createCopy(ctx, address, len) {
    const buffer = new ArrayBuffer(len);
    const copy = getMemoryCopier(len);
    const dv = new DataView(buffer);
    ctx.bufferMap.set(buffer, { address, len, dv, copy });
    return dv;
  }

  function obtainDataView(ctx, address, len, disposition) {
    if (disposition === MemoryDisposition.Copy) {
      return createCopy(ctx, address, len);
    } else if (disposition === MemoryDisposition.Auto) {
      // look for address among existing buffers
      for (const [ buffer, { address: start, len: count } ] of ctx.bufferMap) {
        if (start <= address && address + len <= start + count) {
          const offset = address - start;
          return new DataView(buffer, offset, len);
        }
      }
    }
    if (process.env.NODE_ZIG_TARGET === 'WASM-COMPTIME') {
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
      dv[SOURCE] = { memory: wasmMemory, address, len };
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
    const s = getString(address, len);
    // remove any trailing newline character
    console.log(s.replace(/\r?\n$/, ''));
  }
}

export function serializeDefinitions(structures, params) {
  const {
    runtimeURL,
    loadWASM,
  } = params;
  const lines = [];
  let indent = 0;
  function add(s) {
    if (/^\s*[\]\}]/.test(s)) {
      indent--;
    }
    lines.push(' '.repeat(indent * 2) + s);
    if (/[\[\{]\s*$/.test(s)) {
      indent++;
    }
  }
  const structureFeatures = {}, memberFeatures = {};
  for (const structure of structures) {
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
  if (loadWASM) {
    imports.push('linkWASMBinary');
  }
  imports.push(...features);
  add(`import {`);
  for (const name of imports) {
    add(`${name},`);
  }
  add(`} from ${JSON.stringify(runtimeURL)};`);

  add(`\n// activate features`);
  for (const feature of features) {
    add(`${feature}();`);
  }

  add(`\n// define structures`);
  const structureNames = new Map();
  const arrayBufferNames = new Map();
  let arrayBufferCount = 0;
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    addStructure(varname, structure);
    structureNames.set(structure, varname);
  }

  add(`\n// finalize structures`);
  const varnames = [ ...structureNames.values() ];
  if (varnames.length <= 10) {
    add(`const structures = [ ${varnames.join(', ') } ];`);
  } else {
    add(`const structures = [`);
    for (let i = 0; i < varnames.length; i += 10) {
      const slice = varnames.slice(i, i + 10);
      add(`${slice.join(', ')},`);
    }
    add(`];`);
  }
  add(`const linkage = finalizeStructures(structures);`);

  // the root structure gets finalized last
  const root = structures[structures.length - 1];
  add(`const module = ${structureNames.get(root)}.constructor;`);

  if (loadWASM) {
    add('\n// initialize loading and compilation of WASM bytecodes');
    add(`const binaryPromise = ${loadWASM};`);
    // TODO: figure out how best to load the binary
    add('const __init = linkWASMBinary(binaryPromise, linkage);');
  } else {
    add('\n// no need to initialize WASM binary');
    add('const __init = Promise.resolve(true);');
  }

  add('\n// export functions, types, and constants');
  const exportables = [];
  for (const method of root.methods) {
    exportables.push(method.name);
  }
  for (const member of root.static.members) {
    // only read-only properties are exportable
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
    add(`${name},`);
  }
  add(`} = module;`);
  add(`export {`);
  for (const name of [ 'module as default', ...exportables, '__init' ]) {
    add(`${name},`);
  }
  add(`};`);
  add(``);

  function addStructure(varname, structure) {
    addBuffers(structure.instance.template);
    addBuffers(structure.static.template);
    add(`const ${varname} = {`);
    for (const [ name, value ] of Object.entries(structure)) {
      switch (name) {
        case 'instance':
        case 'static':
          add(`${name}: {`);
          addMembers(value.members);
          addTemplate(value.template);
          add(`},`);
          break;
        case 'methods':
          addMethods(value);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`};`);
  }

  function addMembers(members) {
    if (members.length > 0) {
      add(`members: [`);
      for (const member of members) {
        addMember(member);
      }
      add(`],`);
    } else {
      add(`members: [],`);
    }
  }

  function addMember(member) {
    add(`{`);
    for (const [ name, value ] of Object.entries(member)) {
      switch (name) {
        case 'structure':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`},`);
  }

  function addTemplate(template) {
    addObject('template', template);
  }

  function addObject(name, object) {
    if (object) {
      const { [STRUCTURE]: structure, [MEMORY]: dv, [SLOTS]: slots } = object;
      add(`${name}: {`);
      if (structure) {
        add(`structure: ${structureNames.get(structure)},`);
      }
      if (dv) {
        const buffer = arrayBufferNames.get(dv.buffer);
        const pairs = [ `array: ${buffer}` ];
        if (dv.byteLength < dv.buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        if (dv.hasOwnProperty('address')) {
          add(`address: ${dv.address},`);
        }
      }
      if (slots && Object.keys(slots).length > 0) {
        add(`slots: {`);
        for (const [ slot, child ] of Object.entries(slots)) {
          addObject(slot, child);
        }
        add(`},`);
      }
      add(`},`);
    } else {
      add(`${name}: null`);
    }
  }

  function addBuffers(object) {
    if (object) {
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      if (dv && !arrayBufferNames.get(dv.buffer)) {
        const varname = `a${arrayBufferCount++}`;
        arrayBufferNames.set(dv.buffer, varname);
        const ta = new Uint8Array(dv.buffer);
        add(`const ${varname} = new Uint8Array([ ${ta.join(', ')} ]);`);
      }
      if (slots) {
        for (const [ slot, child ] of Object.entries(slots)) {
          addBuffers(child);
        }
      }
    }
  }

  function addMethods(methods) {
    if (methods.length > 0) {
      add(`methods: [`);
      for (const method of methods) {
        addMethod(method);
      }
      add(`],`);
    } else {
      add(`methods: [],`)
    }
  }

  function addMethod(method) {
    add(`{`);
    for (const [ name, value ] of Object.entries(method)) {
      switch (name) {
        case 'argStruct':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`},`);
  }

  return lines.join('\n');
}

export function finalizeStructures(structures) {
  const variables = {};
  for (const structure of structures) {
    for (const target of [ structure.static, structure.instance ]) {
      // first create the actual template using the provided placeholder
      if (target.template) {
        target.template = createTemplate(target.template);
      }
    }
    for (const method of structure.methods) {
      // create thunk function
      method.thunk = createThunk(method.thunk);
    }
    finalizeStructure(structure);
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
      const { size } = placeholder.structure;
      dv = new DataView(new ArrayBuffer(size));
    }
    const { constructor } = placeholder.structure;
    const object = constructor.call(null, dv);
    if (placeholder.slots) {
      insertObjects(object[SLOTS], placeholder.slots);
    }
    if (placeholder.address !== undefined) {
      // need to replace dataview with one pointing to WASM memory later,
      // when the VM is up and running
      variables[placeholder.address] = object;
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
      // wait for linking to occur, then active the runner again
      return promise.then(() => methodRunner[0].call(this, index, argStruct));
    },
  };

  function createThunk(index) {
    return function(argStruct) {
      return methodRunner[0](index, argStruct);
    };
  }

  return { promise, resolve, reject, variables, methodRunner };
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
  useType,
} from './member.js';
