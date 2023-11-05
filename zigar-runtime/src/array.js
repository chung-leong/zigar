import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory, getPointerAlign } from './memory.js';
import { requireDataView, addTypedArray, getCompatibleTags } from './data-view.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch, throwNoInitializer } from './error.js';
import { MEMORY, SLOTS, PARENT, GETTER, SETTER, PROXY, COMPAT, CHILD_VIVIFICATOR, POINTER_VISITOR, SELF } from './symbol.js';
import { copyPointer, getProxy } from './pointer.js';

export function finalizeArray(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  /* DEV-TEST */
  /* c8 ignore next 6 */
  if (member.bitOffset !== undefined) {
    throw new Error(`bitOffset must be undefined for array member`);
  }
  if (member.slot !== undefined) {
    throw new Error(`slot must be undefined for array member`);
  }
  /* DEV-TEST-END */
  addTypedArray(s);
  const hasObject = (member.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    self[GETTER] = null;
    self[SETTER] = null;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy.call(self);
  };
  const { structure: elementStructure } = member;
  const copy = getMemoryCopier(byteSize);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true });
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throwArrayLengthMismatch(s, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i++, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            this[key] = arg[key];
          }
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { value: length, configurable: true },
    $: { get: getProxy, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true, writable: true },
    entries: { value: createArrayEntries, configurable: true, writable: true }
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
  });
  if (hasObject) {
    addChildVivificator(s);
    if (hasPointer) {
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

export function addChildVivificator(s) {
  const { constructor: { prototype }, instance: { members: [ member ]} } = s;
  const { byteSize, structure } = member;
  const vivificator = function getChild(index) {
    let object = this[SLOTS][index];
    if (!object) {
      const { constructor } = structure;
      const dv = this[MEMORY];
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = new DataView(dv.buffer, offset, byteSize);
      object = this[SLOTS][index] = constructor.call(PARENT, childDV);
    }
    return object;
  };
  Object.defineProperty(prototype, CHILD_VIVIFICATOR, { value: vivificator });
}

export function addPointerVisitor(s) {
  const { constructor: { prototype } } = s;
  const visitor = function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
    } = options;
    const childOptions = { ...options };
    for (let i = 0, len = this.length; i < len; i++) {
      // no need to check for empty slots, since that isn't possible
      if (source) {
        childOptions.source = source?.[SLOTS][i];
      }
      const child = (vivificate) ? this[CHILD_VIVIFICATOR](i) : this[SLOTS][i];
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
  Object.defineProperty(prototype, POINTER_VISITOR, { value: visitor });
}

export function getArrayIterator() {
  const self = this[SELF] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self.get(index);
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getArrayEntriesIterator() {
  const self = this[SELF] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = [ index, self.get(index) ];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function createArrayEntries() {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this),
    length: this.length,
  };
}

export function createProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

const proxyHandlers = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else {
      switch (name) {
        case 'get':
          if (!array[GETTER]) {
            array[GETTER] = array.get.bind(array);
          }
          return array[GETTER];
        case 'set':
          if (!array[SETTER]) {
            array[SETTER] = array.set.bind(array);
          }
          return array[SETTER];
        case SELF:
          return array;
        default:
          return array[name];
      }
    }
  },
  set(array, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      array.set(index, value);
    } else {
      switch (name) {
        case 'get':
          array[GETTER] = value;
          break;
        case 'set':
          array[SETTER] = value;
          break;
        default:
          array[name] = value;
      }
    }
    return true;
  },
  deleteProperty(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      switch (name) {
        case 'get':
          delete array[GETTER];
          break;
        case 'set':
          delete array[SETTER];
          break;
        default:
          delete array[name];
      }
      return true;
    }
  },
  has(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return (index >= 0 && index < array.length);
    } else {
      return array[name];
    }
  },
  ownKeys(array) {
    const keys = [];
    for (let i = 0, len = array.length; i < len; i++) {
      keys.push(`${i}`);
    }
    keys.push('length', PROXY);
    return keys;
  },
  getOwnPropertyDescriptor(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      if (index >= 0 && index < array.length) {
        return { value: array.get(index), enumerable: true, writable: true, configurable: true };
      }
    } else {
      return Object.getOwnPropertyDescriptor(array, name);
    }
  },
};
