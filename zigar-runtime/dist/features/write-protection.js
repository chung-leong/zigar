import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { POINTER, ARRAY, CONST_TARGET } from '../symbols.js';

var writeProtection = mixin({
  makeReadOnly(object) {
    protect(object);
  }
});

const gp = Object.getOwnPropertyDescriptors;
const df = Object.defineProperty;

function protect(object) {
  const pointer = object[POINTER];
  if (pointer) {
    protectProperties(pointer, [ 'length' ]);
  } else {
    const array = object[ARRAY];
    if (array) {
      protectProperties(array);
      protectElements(array);
    } else {
      protectProperties(object);
    }
  }
}

function protectProperties(object, exclude = []) {
  const descriptors = gp(object.constructor.prototype);
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor.set && !exclude.includes(name)) {
      descriptor.set = throwReadOnly;
      df(object, name, descriptor);
    }
  }
  df(object, CONST_TARGET, { value: object });
}

function protectElements(array) {
  df(array, 'set', { value: throwReadOnly });
  const get = array.get;
  const getReadOnly = function(index) {
    const element = get.call(this, index);
    if (element?.[CONST_TARGET] === null) {
      protect(element);
    }
    return element;
  };
  df(array, 'get', { value: getReadOnly });
}

export { writeProtection as default };
