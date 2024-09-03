import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { deanimalizeErrorName, ErrorExpected, InvalidInitializer, NotInErrorSet } from '../errors.js';
import { CAST, CLASS, INITIALIZE } from '../symbols.js';
import { defineProperties, defineValue } from '../utils.js';

export default mixin({
  currentGlobalSet: undefined,
  currentErrorClass: undefined,

  defineErrorSet(structure, descriptors) {
    const {
      name,
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
      return this.currentGlobalSet;
    }
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    const expected = [ 'string', 'number' ];
    const propApplier = this.createApplier(structure);
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
    const constructor = this.createConstructor(structure, {
      onCastError(structure, arg) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    });
    descriptors.$ = descriptor;
    descriptors[INITIALIZE] = initializer;
    return constructor;
  },
  finalizeErrorSet(structure, descriptors, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    const items = template[SLOTS];
    // obtain getter/setter for accessing int values directly
    const { get } = this.defineMember(member, false);
    for (const { name, slot } of members) {
      const item = items[slot];
      // unlike enums, error objects in an error-set aren't instances of the error-set class
      // they're instance of a superclass of JavaScript's Error; here we need to extract the
      // error number from the error-set instance and create the error object, if hasn't been
      // created already for an earlier set
      const number = get.call(item);
      let error = this.currentGlobalSet[number], inGlobalSet = true;
      if (!error) {
        const errorClass = errorSet[CLASS];
        error = new errorClass(name, number);
        inGlobalSet = false;
      }
      // make the error object available by index, by name, and by error message
      const descriptor = defineValue(error);
      const string = String(error);
      staticDescriptors[name] =
      staticDescriptors[string] =
      staticDescriptors[index] = descriptor;
      if (!inGlobalSet) {
        // add to global error set as well
        defineProperties(this.currentGlobalSet, {
          [number]: descriptor,
          [string]: descriptor,
          [name]: descriptor,
        });
      }
    }
    // add cast handler allowing strings, numbers, and JSON object to be casted into error set
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg) === 'number' || typeof(arg) === 'string') {
          return constructor[arg];
        } else if (arg instanceof constructor[CLASS]) {
          return constructor[Number(arg)];
        } else if (isErrorJSON(arg)) {
          return constructor[`Error: ${arg.error}`];
        } else {
          return false;
        }
      }
    };
  },
  transformDescriptorErrorSet(int, structure) {
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
