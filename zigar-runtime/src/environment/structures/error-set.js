import { getTypedArrayClass } from '../../data-view.js';
import { deanimalizeErrorName, ErrorExpected, InvalidInitializer, NotInErrorSet } from '../../error.js';
import { getMemoryCopier } from '../../memory.js';
import {
  createPropertyApplier, defineProperties, makeReadOnly
} from '../../object.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf
} from '../../special.js';
import { ALIGN, CLASS, COPIER, GETTER, PROPS, SIZE, TYPE, WRITE_DISABLER } from '../../symbol.js';
import { isErrorJSON } from '../../types.js';
import { mixin } from '../class.js';
import { StructureType } from './all.js';

mixin({
  currentGlobalSet: undefined,
  currentErrorClass: undefined,

  defineErrorSet(structure) {
    const {
      name,
      byteSize,
      align,
      instance: { members: [ member ] },
    } = structure;
    if (!this.currentErrorClass) {
      this.currentErrorClass = class ZigError extends ZigErrorBase {};
      const ae = { ...structure, name: 'anyerror' };
      this.defineErrorSet(ae);
      this.currentGlobalSet = ae.constructor;
    }
    if (this.currentGlobalSet && name === 'anyerror') {
      structure.constructor = this.currentGlobalSet;
      structure.typedArray = getTypedArrayClass(member);
      return this.currentGlobalSet;
    }
    const errorClass = this.currentErrorClass;
    const { get, set } = this.getDescriptor(member);
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
      } else if (!this.getDataView(structure, arg)) {
        throw new InvalidInitializer(structure, expected, arg);
      } else {
        return false;
      }
    };
    // items are inserted when static members get attached in static.js
    const constructor = structure.constructor = this.createConstructor(structure, { initializer, alternateCaster });
    const typedArray = structure.typedArray = getTypedArrayClass(member);
    const instanceDescriptors = {
      $: { get, set },
      dataView: getDataViewDescriptor(structure),
      base64: getBase64Descriptor(structure),
      typedArray: typedArray && getTypedArrayDescriptor(structure),
      valueOf: { value: getValueOf },
      toJSON: { value: convertToJSON },
      delete: { value: this.getDestructor() },
      [COPIER]: { value: getMemoryCopier(byteSize) },
      [WRITE_DISABLER]: { value: makeReadOnly },
    };
    const staticDescriptors = {
      [ALIGN]: { value: align },
      [SIZE]: { value: byteSize },
      [CLASS]: { value: errorClass },
      // the PROPS array is normally set in static.js; it needs to be set here for anyerror
      // so we can add names to it as error sets are defined
      [PROPS]: (name === 'anyerror') ? { value: [] } : undefined,
      [TYPE]: { value: structure.type },
    };
    this.attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
  },
  transformErrorSetDescriptor(int, structure) {
    const findError = function(value) {
      const { constructor } = structure;
      const item = constructor(value);
      if (!item) {
        if (value instanceof Error) {
          throw new NotInErrorSet(structure);
        } else {
          throw new ErrorExpected(structure, value);
        }
      }
      return item
    };
    return {
      get: (int.get.length === 0)
      ? function getError(hint) {
          const value = int.get.call(this);
          if (hint === 'number') {
            return value;
          }
          return findError(value);
        }
      : function getErrorElement(index) {
          const value = int.get.call(this, index);
          return findError(value, false);
        },
      set: (int.set.length === 1)
      ? function setError(value, hint) {
          if (hint !== 'number') {
            const item = findError(value);
            value = Number(item);
          }
          int.set.call(this, value);
        }
      : function setError(index, value) {
          const item = findError(value, false);
          value = Number(item);
          int.set.call(this, index, value);
        },
    };
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.ErrorSet;
}

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
    this.stack = undefined;
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