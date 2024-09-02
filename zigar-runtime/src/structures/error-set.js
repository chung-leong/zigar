import { mixin } from '../environment.js';
import { deanimalizeErrorName, ErrorExpected, InvalidInitializer, NotInErrorSet } from '../errors.js';
import { CLASS, PROPS } from '../symbols.js';
import { defineProperties } from '../utils.js';
import { getTypedArrayClass, StructureType } from './all.js';

export default mixin({
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
    const propApplier = this.createPropertyApplier(structure);
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
    structure.typedArray = getTypedArrayClass(member);
    const instanceDescriptors = {
      $: { get, set },
    };
    const staticDescriptors = {
      [CLASS]: { value: errorClass },
      // the PROPS array is normally set in finalizeStructure.js; we need to set it here
      // for anyerror so we can add names as error sets are defined
      [PROPS]: (name === 'anyerror') ? { value: [] } : undefined,
    };
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
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
      ? function getError() {
          const value = int.get.call(this);
          return findError(value);
        }
      : function getErrorElement(index) {
          const value = int.get.call(this, index);
          return findError(value);
        },
      set: (int.set.length === 1)
      ? function setError(value) {
          if (hint !== 'number') {
            const item = findError(value);
            value = Number(item);
          }
          int.set.call(this, value);
        }
      : function setError(index, value) {
          const item = findError(value);
          value = Number(item);
          int.set.call(this, index, value);
        },
    };
  },
  appendErrorSet(errorSet, name, es) {
    // our Zig export code places error set instance into the static template, which we can't
    // use since all errors need to have the same parent class; here we get the error number
    // and create the actual error object if hasn't been created already for an earlier set
    const number = Number(es);
    let error = this.currentGlobalSet[number];
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
    defineProperties(this.currentGlobalSet, descriptors);
    // add name to prop list
    this.currentGlobalSet[PROPS].push(name);
  },
  resetGlobalErrorSet() {
    this.currentErrorClass = this.currentGlobalSet = undefined;
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.ErrorSet;
}

export function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
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
