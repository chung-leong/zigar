import { ERROR_INDEX } from './symbol.js';
import { throwNoNewError, decamelizeErrorName } from './error.js';

export function finalizeErrorSet(s) {
  const {
    name,
    instance: {
      members,
    },
  } = s;
  const errors = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      throwNoNewError(s);
    }
    const index = Number(arg);
    return errors[index];
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const valueOf = function() { return this[ERROR_INDEX] };
  const toStringTag = function() { return 'Error' };
  Object.defineProperties(constructor.prototype, {
    // provide a way to retrieve the error index
    [Symbol.toPrimitive]: { value: valueOf, configurable: true, writable: true },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag, configurable: true },
  });
  // attach the errors to the constructor and the
  for (const [ index, { name, slot } ] of members.entries()) {
    // can't use the constructor since it would throw
    const error = Object.create(constructor.prototype);
    const message = decamelizeErrorName(name);
    Object.defineProperties(error, {
      message: { value: message, configurable: true, enumerable: true, writable: false },
      [ERROR_INDEX]: { value: slot },
    });
    Object.defineProperties(constructor, {
      [name]: { value: error, configurable: true, enumerable: true, writable: true },
    });
    errors[slot] = error;
  }
  return constructor;
};
