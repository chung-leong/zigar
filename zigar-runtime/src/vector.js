import { getCompatibleTags, getTypedArrayClass } from './data-view.js';
import { throwArrayLengthMismatch, throwInvalidArrayInitializer } from './error.js';
import { getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { attachDescriptors, createConstructor, createPropertyApplier, getSelf } from './object.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf
} from './special.js';
import { ALIGN, COMPAT, COPIER, NORMALIZER, PROP_SETTERS, SIZE } from './symbol.js';

export function defineVector(structure, env) {
  const {
    length,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  /* DEV-TEST */
  /* c8 ignore next 6 */  
  if (member.bitOffset !== undefined) {
    throw new Error(`bitOffset must be undefined for vector member`);
  }
  if (member.slot !== undefined) {
    throw new Error(`slot must be undefined for vector member`);
  }
  /* DEV-TEST-END */
  const { bitSize: elementBitSize, structure: elementStructure } = member;
  const elementDescriptors = {};
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
    const { get, set } = getDescriptor({ ...member, bitOffset }, env);
    elementDescriptors[i] = { get, set, configurable: true };
  }
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
    } else if (arg?.[Symbol.iterator]) {
      let argLen = arg.length;
      if (typeof(argLen) !== 'number') {
        arg = [ ...arg ];
        argLen = arg.length;
      }
      if (argLen !== length) {
        throwArrayLengthMismatch(structure, this, arg);
      }
      let i = 0;
      for (const value of arg) {
        this[PROP_SETTERS][i++].call(this, value);
      }
    } else if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throwInvalidArrayInitializer(structure, arg);
      }
    } else if (arg !== undefined) {
      throwInvalidArrayInitializer(structure, arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    ...elementDescriptors,
    $: { get: getSelf, set: initializer },
    length: { value: length },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    entries: { value: getVectorEntries },
    delete: { value: getDestructor(structure) },
    [Symbol.iterator]: { value: getVectorIterator },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: normalizeVector },
  };
  const staticDescriptors = {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeVector(cb, options) {
  const array = [];
  for (const [ index, value ] of getVectorEntries.call(this, options)) {
    array.push(cb(value));
  }
  return array;
}

export function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self[current];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getVectorEntriesIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, self[current] ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}
