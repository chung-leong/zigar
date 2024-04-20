import { getDataView, getTypedArrayClass } from './data-view.js';
import { InvalidInitializer, deanimalizeErrorName } from './error.js';
import { getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import {
  attachDescriptors, createConstructor, createPropertyApplier, defineProperties, makeReadOnly
} from './object.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf
} from './special.js';
import { ALIGN, CLASS, COPIER, GETTER, NORMALIZER, PROPS, SIZE, WRITE_DISABLER } from './symbol.js';
import { isErrorJSON } from './types.js';

let currentGlobalSet;
let currentErrorClass;

export function defineErrorSet(structure, env) {
  const {
    name,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  if (!currentErrorClass) {
    currentErrorClass = class ZigError extends ZigErrorBase {};
    currentGlobalSet = defineErrorSet({ ...structure, name: 'anyerror' }, env);
  } 
  if (currentGlobalSet && name === 'anyerror') {
    structure.constructor = currentGlobalSet;
    structure.typedArray = getTypedArrayClass(member);
    return currentGlobalSet;
  }
  const errorClass = currentErrorClass;
  const { get, set } = getDescriptor(member, env);
  const expected = [ 'string', 'number' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor[CLASS]) {
      set.call(this, arg);
    } else if (arg && typeof(arg) === 'object' && !isErrorJSON(arg)) {
      if (propApplier.call(this, arg) === 0) {
        throw new InvalidInitializer(structure, expected, arg);
      }  
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    let dv;
    if (typeof(arg) === 'number' || typeof(arg) === 'string') {
      return constructor[arg];
    } else if (arg instanceof constructor[CLASS]) {
      return constructor[Number(arg)];
    } else if (isErrorJSON(arg)) {
      return constructor[`Error: ${arg.error}`];
    } else if (!getDataView(structure, arg, env)) {
      throw new InvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  // items are inserted when static members get attached in static.js
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: get },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [CLASS]: { value: errorClass },
    // the PROPS array is normally set in static.js; it needs to be set here for anyerror 
    // so we can add names to it as error sets are defined
    [PROPS]: (name === 'anyerror') ? { value: [] } : undefined,
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function appendErrorSet(errorSet, name, es) {
  // our Zig export code places error set instance into the static template, which we can't 
  // use since all errors need to have the same parent class; here we get the error number 
  // and create the actual error object if hasn't been created already for an earlier set
  const number = es[GETTER]('number');
  let error = currentGlobalSet[number];
  if (!error) {
    const errorClass = errorSet[CLASS];
    error = new errorClass(name, number);
  }
  const string = String(error);
  const descriptors = {
    [number]: { value: error },
    [string]: { value: error },
    [name]: { value: error },
  };
  defineProperties(errorSet, descriptors);
  defineProperties(currentGlobalSet, descriptors); 
  // add name to prop list
  currentGlobalSet[PROPS].push(name);
}

export function resetGlobalErrorSet() {
  currentErrorClass = currentGlobalSet = undefined;
}

class ZigErrorBase extends Error {
  constructor(name, number) {
    super(deanimalizeErrorName(name));
    this.number = number;
  }

  [Symbol.toPrimitive](hint) {
    switch (hint) {
      case 'string':
      case 'default':
        return Error.prototype.toString.call(this, hint);
      default:
        return this.number;
    }
  }

  toJSON() {
    return { error: this.message };
  }
}