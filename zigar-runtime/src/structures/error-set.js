import { MemberType, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import {
  deanimalizeErrorName, ErrorExpected, InvalidInitializer, isErrorJSON, NotInErrorSet
} from '../errors.js';
import { CAST, CLASS, INITIALIZE, PROPS, SLOTS } from '../symbols.js';
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
      // create anyerror set
      this.currentErrorClass = class Error extends ZigErrorBase {};
      const ae = {
        type: StructureType.ErrorSet,
        name: 'anyerror',
        instance: { members: [ member ] },
        static: { members: [], template: { SLOTS: {} } },
      };
      this.defineStructure(ae);
      this.finalizeStructure(ae);
      this.currentGlobalSet = ae.constructor;
    }
    if (this.currentGlobalSet && name === 'anyerror') {
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
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
  finalizeErrorSet(structure, staticDescriptors) {
    const {
      constructor,
      name,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    if (this.currentGlobalSet && name === 'anyerror') {
      // already finalized
      return false;
    }
    const items = template?.[SLOTS] ?? {};
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
        error = new this.currentErrorClass(name, number);
        inGlobalSet = false;
      }
      // make the error object available by errno, by name, and by error message
      const descriptor = defineValue(error);
      const string = String(error);
      staticDescriptors[name] =
      staticDescriptors[string] =
      staticDescriptors[number] = descriptor;
      if (!inGlobalSet) {
        // add to global error set as well
        defineProperties(this.currentGlobalSet, {
          [number]: descriptor,
          [string]: descriptor,
          [name]: descriptor,
        });
        this.currentGlobalSet[PROPS].push(name);
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
        } else if (arg instanceof Error) {
          return undefined;
        } else {
          return false;
        }
      }
    };
    staticDescriptors[CLASS] = defineValue(this.currentErrorClass);
  },
  transformDescriptorErrorSet(descriptor, member) {
    const { type, structure } = member;
    if (type === MemberType.Object) {
      return descriptor;
    }
    const findError = function(value) {
      const { constructor } = structure;
      debugger;
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
    const { get, set } = descriptor;
    return {
      get: (get.length === 0)
      ? function getError() {
          const value = get.call(this);
          return findError(value);
        }
      : function getErrorElement(index) {
          const value = get.call(this, index);
          return findError(value);
        },
      set: (set.length === 1)
      ? function setError(value) {
        const item = findError(value);
          value = Number(item);
          set.call(this, value);
        }
      : function setError(index, value) {
          const item = findError(value);
          value = Number(item);
          set.call(this, index, value);
        },
    };
  },
  resetGlobalErrorSet() {
    this.currentErrorClass = this.currentGlobalSet = undefined;
  },
});

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
