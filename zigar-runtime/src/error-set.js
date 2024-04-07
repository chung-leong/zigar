import { getDataView, getTypedArrayClass } from './data-view.js';
import { deanimalizeErrorName, throwInvalidInitializer } from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf } from './special.js';
import { attachDescriptors, createConstructor, createPropertyApplier, defineProperties } from './structure.js';
import { ALIGN, COPIER, ITEMS, MEMORY, MESSAGE, NORMALIZER, PROPS, SIZE } from './symbol.js';

let currentGlobalSet;
let currentPrototype;

export function defineErrorSet(structure, env) {
  const {
    name,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  const prototype = currentPrototype;
  const { get: getIndex } = getDescriptor(member, env);
  // get the error descriptor instead of the int/uint descriptor
  const { get, set } = getDescriptor({ ...member, type: MemberType.Error, structure }, env);
  const expected = [ 'string', 'number' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg && typeof(arg) === 'object' && !isErrorJSON(arg)) {
      if (propApplier.call(this, arg) === 0) {
        throwInvalidInitializer(structure, expected, arg);
      }  
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg) === 'number' || typeof(arg) === 'string') {
      return items[arg];
    } else if (isErrorJSON(arg)) {
      return items[`Error: ${arg.error}`];
    } else if (!getDataView(structure, arg, env)) {
      throwInvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  // items are inserted when static members get attached in static.js
  const items = {};
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  if (name === 'anyerror') {
    // replace placeholder with the real thing
    const placeholder = currentGlobalSet;
    constructor.prototype = prototype;
    defineProperties(constructor, {
      [ITEMS]: { value: items },
      [PROPS]: { value: [] },
    });
    currentGlobalSet = constructor;
    for (const name of placeholder[PROPS]) {
      const error = placeholder[name];
      const index = getIndex.call(error);
      appendGlobalErrorSet(name, index, error);
    }
  } else {
    Object.setPrototypeOf(constructor.prototype, prototype);
  }
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const getMessage = function() { return this[MESSAGE] ?? this.$.message };
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
    [NORMALIZER]: { value: get },
  };
  const staticDescriptors = {
    has: { value: findError },
    includes: { value: findError },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ITEMS]: { value: items },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

function findError(error) {
  // compare prototype of global set
  const thatGlobalProto = Object.getPrototypeOf(error?.constructor?.prototype ?? {});
  const thisGlobalProto = Object.getPrototypeOf(this.prototype);
  if (thatGlobalProto === thisGlobalProto || thatGlobalProto === this.prototype) {
    const items = this[ITEMS];
    const index = Number(error);
    return !!items[index];  
  } else {
    return false;
  }
}

export function appendErrorSet(errorSet, name, error) {
  const index = Number(error);
  const errors = errorSet[ITEMS];
  // set error message and add to hash
  error[MESSAGE] = deanimalizeErrorName(name);
  errors[index] = errors[name] = errors[String(error)] = error;
  // add to global set
  appendGlobalErrorSet(name, index, error);
}

function appendGlobalErrorSet(name, index, error) {
  const errors = currentGlobalSet[ITEMS];
  const errorG = currentGlobalSet(error[MEMORY]);
  errorG[MESSAGE] = error[MESSAGE];
  errors[index] = errors[name] = errors[String(error)] = errorG;
  currentGlobalSet[PROPS].push(name);
  defineProperties(currentGlobalSet, { [name]: { value: errorG } });
}

export function resetGlobalErrorSet() {
  // set to placeholder
  currentGlobalSet = function(dv) { return { [MEMORY]: dv } };
  currentGlobalSet[ITEMS] = {};
  currentGlobalSet[PROPS] = [];
  currentPrototype = Object.setPrototypeOf({}, Error.prototype);
}

export function getGlobalErrorSet() {
  return currentGlobalSet;
}

export function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
}
