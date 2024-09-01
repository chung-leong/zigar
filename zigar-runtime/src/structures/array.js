import { getTypedArrayClass } from '../../data-view.js';
import {
  makeReadOnly
} from '../../object.js';
import { always, copyPointer, getProxy } from '../../pointer.js';
import {
  handleError
} from '../../special.js';
import { mixin } from '../class.js';
import { ArrayLengthMismatch, InvalidArrayInitializer, throwReadOnly } from '../error.js';
import { MemberType } from '../members/all.js';
import {
  ARRAY,
  CONST_TARGET, COPIER, ELEMENT_GETTER, ELEMENT_SETTER, ENTRIES_GETTER,
  MEMORY, PARENT, POINTER_VISITOR, PROXY,
  SLOTS,
  VIVIFICATOR, WRITE_DISABLER
} from '../symbol.js';
import { StructureType } from './all.js';

export default mixin({
  defineArray(structure) {
    const {
      length,
      byteSize,
      align,
      instance: { members: [ member ] },
      hasPointer,
    } = structure;
    /* c8 ignore start */
    if (process.env.DEV) {
      if (member.bitOffset !== undefined) {
        throw new Error(`bitOffset must be undefined for array member`);
      }
      if (member.slot !== undefined) {
        throw new Error(`slot must be undefined for array member`);
      }
    }
    /* c8 ignore end */
    const { get, set } = this.getDescriptor(member);
    const hasStringProp = canBeString(member);
    const propApplier = this.createPropertyApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPIER](arg);
        if (hasPointer) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      } else {
        if (typeof(arg) === 'string' && hasStringProp) {
          arg = { string: arg };
        }
        if (arg?.[Symbol.iterator]) {
          arg = transformIterable(arg);
          if (arg.length !== length) {
            throw new ArrayLengthMismatch(structure, this, arg);
          }
          let i = 0;
          for (const value of arg) {
            set.call(this, i++, value);
          }
        } else if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            throw new InvalidArrayInitializer(structure, arg);
          }
        } else if (arg !== undefined) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      }
    };
    const finalizer = createArrayProxy;
    const constructor = structure.constructor = this.createConstructor(structure, { initializer, finalizer });
    const typedArray = structure.typedArray = getTypedArrayClass(member);
    const hasObject = member.type === MemberType.Object;
    const instanceDescriptors = {
      $: { get: getProxy, set: initializer },
      length: { value: length },
      get: { value: get },
      set: { value: set },
      entries: { value: getArrayEntries },
      [Symbol.iterator]: { value: getArrayIterator },
      [ENTRIES_GETTER]: { value: getArrayEntries },
      [VIVIFICATOR]: hasObject && { value: this.getChildVivificator(structure) },
      [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure) },
      [WRITE_DISABLER]: { value: makeArrayReadOnly },
    };
    const staticDescriptors = {
      child: { get: () => member.structure.constructor },
    };
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  }
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Array;
}

export function createArrayProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

export function makeArrayReadOnly() {
  makeReadOnly.call(this);
  Object.defineProperty(this, 'set', { value: throwReadOnly });
  const get = this.get;
  const getReadOnly = function(index) {
    const element = get.call(this, index);
    if (element?.[CONST_TARGET] === null) {
      element[WRITE_DISABLER]?.();
    }
    return element;
  };
  Object.defineProperty(this, 'get', { value: getReadOnly });
}

export function canBeString(member) {
  return member.type === MemberType.Uint && [ 8, 16 ].includes(member.bitSize);
}

export function getArrayIterator() {
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self.get(current);
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getArrayEntriesIterator(options) {
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => self.get(current), options) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getArrayEntries(options) {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this, options),
    length: this.length,
  };
}

export function getChildVivificator(structure, env) {
  const { instance: { members: [ member ]} } = structure;
  const { byteSize, structure: elementStructure } = member;
  return function getChild(index) {
    const { constructor } = elementStructure;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + byteSize * index;
    const childDV = env.obtainView(dv.buffer, offset, byteSize);
    const object = this[SLOTS][index] = constructor.call(PARENT, childDV);
    return object;
  };
}

export function getPointerVisitor(structure) {
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: () => isActive(this),
      isMutable: () => isMutable(this),
    };
    for (let i = 0, len = this.length; i < len; i++) {
      // no need to check for empty slots, since that isn't possible
      if (source) {
        childOptions.source = source?.[SLOTS][i];
      }
      const child = this[SLOTS][i] ?? (vivificate ? this[VIVIFICATOR](i) : null);
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}

export function transformIterable(arg) {
  if (typeof(arg.length) === 'number') {
    // it's an array of sort
    return arg;
  }
  const iterator = arg[Symbol.iterator]();
  const first = iterator.next();
  const length = first.value?.length;
  if (typeof(length) === 'number' && Object.keys(first.value).join() === 'length') {
    // return generator with length attached
    return Object.assign((function*() {
      let result;
      while (!(result = iterator.next()).done) {
        yield result.value;
      }
    })(), { length });
  } else {
    const array = [];
    let result = first;
    while (!result.done) {
      array.push(result.value);
      result = iterator.next();
    }
    return array;
  }
}

const proxyHandlers = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else {
      switch (name) {
        case 'get':
          if (!array[ELEMENT_GETTER]) {
            array[ELEMENT_GETTER] = array.get.bind(array);
          }
          return array[ELEMENT_GETTER];
        case 'set':
          if (!array[ELEMENT_SETTER]) {
            array[ELEMENT_SETTER] = array.set.bind(array);
          }
          return array[ELEMENT_SETTER];
        case ARRAY:
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
          array[ELEMENT_GETTER] = value;
          break;
        case 'set':
          array[ELEMENT_SETTER] = value;
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
          delete array[ELEMENT_GETTER];
          break;
        case 'set':
          delete array[ELEMENT_SETTER];
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
