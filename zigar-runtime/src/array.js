import { getCompatibleTags, getTypedArrayClass } from './data-view.js';
import { throwArrayLengthMismatch, throwInvalidArrayInitializer } from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { always, copyPointer, getProxy } from './pointer.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getStringDescriptor,
  getTypedArrayDescriptor, getValueOf
} from './special.js';
import { attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import {
  ALIGN,
  ARRAY,
  COMPAT,
  COPIER,
  GETTER, MEMORY,
  NORMALIZER,
  PARENT,
  PROXY,
  SETTER, SIZE, SLOTS,
  VISITOR,
  VIVIFICATOR
} from './symbol.js';

export function defineArray(structure, env) {
  const {
    length,
    byteSize,
    align,
    instance: { members: [ member ] },
    hasPointer,
  } = structure;
  /* DEV-TEST */
  /* c8 ignore next 6 */
  if (member.bitOffset !== undefined) {
    throw new Error(`bitOffset must be undefined for array member`);
  }
  if (member.slot !== undefined) {
    throw new Error(`slot must be undefined for array member`);
  }
  /* DEV-TEST-END */
  const { get, set } = getDescriptor(member, env);
  const hasStringProp = canBeString(member);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        this[VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (typeof(arg) === 'string' && hasStringProp) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throwArrayLengthMismatch(structure, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i++, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throwInvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(structure, arg);
      }
    }
  };
  const finalizer = createArrayProxy;
  const constructor = structure.constructor = createConstructor(structure, { initializer, finalizer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const hasObject = member.type === MemberType.Object;
  const instanceDescriptors = {
    $: { get: getProxy, set: initializer },
    length: { value: length },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    string: hasStringProp && getStringDescriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    get: { value: get },
    set: { value: set },
    entries: { value: getArrayEntries },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: { value: getArrayIterator },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [VISITOR]: hasPointer && { value: getPointerVisitor(structure) },
    [NORMALIZER]: { value: normalizeArray },
  };
  const staticDescriptors = {
    child: { get: () => member.structure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function createArrayProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy }); 
  return proxy;
}

export function canBeString(member) {
  return member.type === MemberType.Uint && [ 8, 16 ].includes(member.bitSize);
}

export function normalizeArray(map, forJSON) {
  let array = map.get(this);
  if (!array) {
    array = [];
    map.set(this, array);
    for (const value of this) {      
      array.push(value[NORMALIZER]?.(map, forJSON) ?? value);
    }
  }
  return array;
}

export function getArrayIterator() {
  const self = this[ARRAY] ?? this;
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
  const self = this[ARRAY] ?? this;
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

export function getArrayEntries() {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this),
    length: this.length,
  };
}

export function getChildVivificator(structure) {
  const { instance: { members: [ member ]} } = structure;
  const { byteSize, structure: elementStructure } = member;
  return function getChild(index, writable = true) {
    const { constructor } = elementStructure;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + byteSize * index;
    const childDV = new DataView(dv.buffer, offset, byteSize);
    const object = this[SLOTS][index] = constructor.call(PARENT, childDV, { writable });
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
        child[VISITOR](cb, childOptions);
      }
    }
  };
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
