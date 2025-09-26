import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { addConstTarget, getProxyTarget } from '../proxies.js';
import { TYPE } from '../symbols.js';

export default mixin({
  makeReadOnly(object) {
    protect(object);
  }
});

const gp = Object.getOwnPropertyDescriptors;
const df = Object.defineProperty;

function protect(object) {
  const type = object.constructor[TYPE]
  if (type === StructureType.Pointer) {
    // protect all properties except length
    protectProperties(object, [ 'length' ]);
  } else if (type === StructureType.Array || type === StructureType.Slice) {
    protectProperties(object);
    protectElements(object);
  } else {
    protectProperties(object);
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
  addConstTarget(object);
}

function protectElements(array) {
  df(array, 'set', { value: throwReadOnly });
  const get = array.get;
  const getReadOnly = function(index) {
    const element = get.call(this, index);    
    if (typeof(element) === 'object') {
      if (!getProxyTarget(element)) {
        protect(element);
      }
    }
    return element;
  };
  df(array, 'get', { value: getReadOnly });
}
