import { ErrorSetFlag, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import {
  deanimalizeErrorName, ErrorExpected, InvalidInitializer, isErrorJSON, NotInErrorSet
} from '../errors.js';
import { CAST, CLASS, INITIALIZE, SLOTS } from '../symbols.js';
import { defineProperties, defineProperty, defineValue } from '../utils.js';

export default mixin({
  init() {
    this.ZigError = class ZigError extends ZigErrorBase {},
    this.globalItemsByIndex = {};
    this.globalItemsByName = {};
  },
  defineErrorSet(structure, descriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
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
      flags,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    const items = template?.[SLOTS] ?? {};
    const itemsByIndex = (flags & ErrorSetFlag.IsOpenEnded) ? this.globalItemsByIndex : {};
    const itemsByName = (flags & ErrorSetFlag.IsOpenEnded) ? this.globalItemsByName : {};
    // obtain getter/setter for accessing int values directly
    const { get } = this.defineMember(member, false);
    for (const { name, slot } of members) {
      const item = items[slot];
      // unlike enums, error objects in an error-set aren't instances of the error-set class
      // they're instance of a superclass of JavaScript's Error; here we need to extract the
      // error number from the error-set instance and create the error object, if hasn't been
      // created already for an earlier set
      const number = get.call(item);
      let error = this.globalItemsByIndex[number];
      const inGlobalSet = !!error;
      if (!error) {
        error = new this.ZigError(name, number);
      }
      // make the error object available by name
      const descriptor = defineValue(error);
      staticDescriptors[name] = descriptor;
      // make it available by error.toString() as well, so that the in operator can be used
      // to see if an error is in a set; note that the text will be prefixed with "Error: "
      // so it's not the same as error.message
      const stringified = `${error}`;
      staticDescriptors[stringified] = descriptor;
      itemsByIndex[number] = error;
      itemsByName[name] = error;
      itemsByName[stringified] = error;
      // add to global set
      if (!inGlobalSet) {
        defineProperties(this.ZigError, {
          [name]: descriptor,
          [stringified]: descriptor,
        });
        this.globalItemsByIndex[number] = error;       
        this.globalItemsByName[name] = error;
        this.globalItemsByName[stringified] = error;
      }
    }
    // add cast handler allowing strings, numbers, and JSON object to be casted into error set
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg) === 'number') {
          return itemsByIndex[arg];
        } else if (typeof(arg) === 'string') {
          return itemsByName[arg];
        } else if (arg instanceof constructor[CLASS]) {
          return itemsByIndex[Number(arg)];
        } else if (isErrorJSON(arg)) {
          return itemsByName[`Error: ${arg.error}`];
        } else if (arg instanceof Error) {
          return itemsByName[`${arg}`];
        } else {
          return false;
        }
      }
    };
    staticDescriptors[CLASS] = defineValue(this.ZigError);
  },
  transformDescriptorErrorSet(descriptor, member) {
    const { type, structure } = member;
    if (type === MemberType.Object) {
      return descriptor;
    }
    const findError = (value) => {
      const { constructor, flags } = structure;
      const item = constructor(value);
      if (!item) {
        if (flags & ErrorSetFlag.IsOpenEnded) {
          if (typeof(value) === 'number') {
            const newItem = new this.ZigError(`Unknown error: ${value}`, value);
            this.globalItemsByIndex[value] = newItem;
            defineProperty(this.ZigError, `${newItem}`, defineValue(newItem));
            return newItem;
          }
        }
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
