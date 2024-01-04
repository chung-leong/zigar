import { ObjectCache, attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView, getTypedArrayClass } from './data-view.js';
import { throwInvalidInitializer, throwNoInitializer } from './error.js';
import { ALIGN, CONST, ERROR_ITEMS, ERROR_MESSAGES, MEMORY, MEMORY_COPIER, SIZE, VALUE_NORMALIZER } from './symbol.js';
import { getBase64Accessors, getDataViewAccessors, getTypedArrayAccessors, getValueOf } from './special.js';

let currentErrorSets;

export function defineErrorSet(structure, env) {
  const {
    name,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  const { get: getIndex } = getDescriptor(member, env);
  // get the enum descriptor instead of the int/uint descriptor
  const { get, set } = getDescriptor({ ...member, type: MemberType.Error, structure }, env);
  const expected = [ 'string', 'number' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throwInvalidInitializer(structure, expected, arg);
      }
    } else {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg) === 'number') {
      return constructor[ERROR_ITEMS][arg];
    } else if (typeof(arg) === 'string') {
      for (const err of Object.values(constructor[ERROR_ITEMS])) {
        if (err.toString() === arg) {
          return err;
        }
      }
    } else if (!getDataView(structure, arg, env)) {
      throwInvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const getMessage = function() {
    const index = getIndex.call(this);
    return constructor[ERROR_MESSAGES][index];
  };
  const toStringTag = function() { return 'Error' };
  const instanceDescriptors = {
    $: { get, set },
    index: { get: getIndex },
    message: { get: getMessage },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    typedArray: typedArray && getTypedArrayAccessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_NORMALIZER]: { value: normalizeError },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ERROR_ITEMS]: { value: {} },
    [ERROR_MESSAGES]: { value: {} },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function normalizeError(map) {
  return this.$;
}

export function initializeErrorSets() {
  currentErrorSets = {};
}

export function getCurrentErrorSets() {
  return currentErrorSets;
}
