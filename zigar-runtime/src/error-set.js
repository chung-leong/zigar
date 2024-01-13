import { getDataView, getTypedArrayClass } from './data-view.js';
import { throwInvalidInitializer } from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf } from './special.js';
import { attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import { ALIGN, COPIER, ITEMS, MESSAGES, NORMALIZER, SIZE } from './symbol.js';

export function defineErrorSet(structure, env) {
  const {
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  const { get: getIndex } = getDescriptor(member, env);
  // get the error descriptor instead of the int/uint descriptor
  const { get, set } = getDescriptor({ ...member, type: MemberType.Error, structure }, env);
  const expected = [ 'string', 'number' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg && typeof(arg) === 'object') {
      try {
        if (propApplier.call(this, arg) === 0) {
          throwInvalidInitializer(structure, expected, arg);
        } 
      } catch (err) {
        const { error } = arg;
        if (typeof(error) === 'string') {
          set.call(this, error);
        } else {
          throw err;
        }
      }
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg) === 'number' || typeof(arg) === 'string') {
      return constructor[ITEMS][arg];
    } else if (!getDataView(structure, arg, env)) {
      throwInvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  Object.setPrototypeOf(constructor.prototype, globalErrorSet.prototype);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const getMessage = function() {
    const index = getIndex.call(this);
    return constructor[MESSAGES][index];
  };
  const toStringTag = function() { return 'Error' };
  const toPrimitive = function(hint) {
    if (hint === 'string') {
      return Error.prototype.toString.call(this, hint);
    } else {
      return getIndex.call(this);
    }
  };
  const instanceDescriptors = {
    $: { get, set },
    message: { get: getMessage },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: normalizeError },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ITEMS]: { value: {} },
    [MESSAGES]: { value: {} },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function normalizeError(map, forJSON) {
  const err = this.$;
  if (forJSON) {
    const { message } = err;
    return { error: message };
  } else {
    return err;
  }
}

let globalErrorSet;

export function createGlobalErrorSet() {
  globalErrorSet = function() {};
  Object.setPrototypeOf(globalErrorSet.prototype, Error.prototype);
}

export function getGlobalErrorSet() {
  return globalErrorSet;
}


