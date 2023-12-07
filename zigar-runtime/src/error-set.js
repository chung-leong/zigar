import { defineProperties } from './structure.js';
import { throwNoNewError, decamelizeErrorName } from './error.js';
import { ERROR_INDEX } from './symbol.js';

let currentErrorSets;

export function defineErrorSet(s, env) {
  const {
    name,
    instance: {
      members,
    },
  } = s;
  const errors = currentErrorSets;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      throwNoNewError(s);
    }
    const index = Number(arg);
    return errors[index];
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  let errorIndices;
  const errorDescriptors = {};
  for (const [ index, { name, slot } ] of members.entries()) {
    let error = errors[slot];
    if (error) {
      // error already exists in a previously defined set
      // see if we should make that set a subclass or superclass of this one
      if (!(error instanceof constructor)) {
        if (!errorIndices) {
          errorIndices = members.map(m => m.slot);
        }
        const otherSet = error.constructor;
        const otherErrors = Object.values(otherSet);
        if (otherErrors.every(e => errorIndices.includes(e[ERROR_INDEX]))) {
          // this set contains the all errors of the other one, so it's a superclass
          Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
        } else {
          // make this set a subclass of the other
          Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
          for (const otherError of otherErrors) {
            if (errorIndices.includes(otherError[ERROR_INDEX])) {
              // this set should be this error object's class
              Object.setPrototypeOf(otherError, constructor.prototype);
            }
          }
        }
      }
    } else {
      // need to create the error object--can't use the constructor since it would throw
      error = Object.create(constructor.prototype);
      const message = decamelizeErrorName(name);
      defineProperties(error, {
        message: { value: message, configurable: true, enumerable: true, writable: false },
        [ERROR_INDEX]: { value: slot },
      });
      errors[slot] = error;
    }
    errorDescriptors[name] = { value: error, configurable: true, enumerable: true, writable: true };
  }
  const getIndex = function() { return this[ERROR_INDEX] };
  const toStringTag = function() { return 'Error' };
  defineProperties(constructor.prototype, {
    // provide a way to retrieve the error index
    index: { get: getIndex, configurable: true },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag, configurable: true },
  });
  defineProperties(constructor, errorDescriptors);
  return constructor;
};

export function initializeErrorSets() {
  currentErrorSets = {};
}