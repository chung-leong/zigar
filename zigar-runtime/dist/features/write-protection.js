import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { removeProxy } from '../proxies.js';
import { MEMORY, READ_ONLY, TYPE } from '../symbols.js';
import { defineProperty, defineProperties, defineValue } from '../utils.js';

var writeProtection = mixin({
  makeReadOnly(object) {
    protect(object);
  }
});

function protect(object) {
  const [ objectNoProxy ] = removeProxy(object);
  if (objectNoProxy?.[MEMORY] && !objectNoProxy[READ_ONLY]) {
    objectNoProxy[READ_ONLY] = true;
    const type = objectNoProxy.constructor[TYPE];
    if (type === StructureType.Pointer) {
      // protect all properties except length
      protectProperties(objectNoProxy, [ 'length' ]);
    } else if (type === StructureType.Array || type === StructureType.Slice) {
      protectProperties(objectNoProxy);
      protectElements(objectNoProxy);
    } else {
      protectProperties(objectNoProxy);
    }
  }
  return object;
}

function protectProperties(object, exclude = []) {
  const descriptors = Object.getOwnPropertyDescriptors(object.constructor.prototype);
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (!exclude.includes(name)) {
      const { get, set } = descriptor;
      descriptor.get = (get) ? function() {
        return protect(get.call(this));
      } : undefined;
      descriptor.set = (set) ? throwReadOnly : undefined;
      defineProperty(object, name, descriptor);
    }
  }
}

function protectElements(array) {
  const { get } = array;
  defineProperties(array, {
    get: defineValue(function(index) { 
      return protect(get.call(this, index));
    }),
    set: defineValue(throwReadOnly),
  });
}

export { writeProtection as default };
