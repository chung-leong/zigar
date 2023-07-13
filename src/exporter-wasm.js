import { MEMORY, SLOTS, ZIG } from './symbol.js';
import { beginStructure, attachMember, attachMethod, attachTemplate } from './structure.js';
import { decamelizeErrorName } from './error.js';
import { getMemoryCopier } from './memory.js';

const LINKAGE = Symbol('linking');

export async function runExporter(wasmBinary) {
  const imports = {
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
    _createFactoryArgument,
  };
  const { module, instance } = await WebAssembly.instantiate(wasmBinary, { env: imports });
  let nextValueIndex = 1;
  const valueTable = { 0: null };
  const valueIndices = new WeakMap();
  let nextStringIndex = 1;
  const stringTable = { 0: null };
  const stringIndices = {};
  const globalSlots = {};
  const { memory, run } = instance.exports;
  const { buffer } = memory;
  const decoder = new TextDecoder();
  const errorIndex = run();
  if (errorIndex !== 0) {
    const errorName = stringTable[errorIndex];
    const errorMsg = decamelizeErrorName(errorName);
    throw new Error(errorMsg);
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

  function _createFactoryArgument() {
    return addObject({
      [SLOTS]: {},
    });
  }
}

