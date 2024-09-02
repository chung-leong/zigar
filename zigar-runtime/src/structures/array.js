import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer, throwReadOnly } from '../errors.js';
import { MemberType } from '../members/all.js';
import {
  makeReadOnly
} from '../object.js';
import { always, copyPointer, getProxy } from '../pointer.js';
import {
  CONST_TARGET, COPIER,
  ENTRIES,
  MEMORY, PARENT,
  PROTECTOR,
  PROXY,
  SELF,
  SLOTS,
  VISITOR,
  VIVIFICATOR
} from '../symbols.js';
import { defineProperties } from '../utils.js';
import { StructureType, getTypedArrayClass } from './all.js';

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
    const hasStringProp = canBeString(member);
    const propApplier = this.createPropertyApplier(structure);
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
    const elementDescriptor = this.getDescriptor(member);
    const finalizer = () => this.finalizeArrayInstance(elementDescriptor);
    const constructor = structure.constructor = this.createConstructor(structure, { initializer, finalizer });
    structure.typedArray = getTypedArrayClass(member);
    const hasObject = member.type === MemberType.Object;
    const instanceDescriptors = {
      $: { get: getProxy, set: initializer },
      length: { value: length },
      entries: { value: getArrayEntries },
      [Symbol.iterator]: { value: getArrayIterator },
      [ENTRIES]: { get: getArrayEntries },
      [VIVIFICATOR]: hasObject && { value: this.getChildVivificator(structure) },
      [VISITOR]: hasPointer && { value: getPointerVisitor(structure) },
      [PROTECTOR]: { value: makeArrayReadOnly },
    };
    const staticDescriptors = {
      child: { get: () => member.structure.constructor },
    };
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  },
  finalizeArrayInstance({ get, set }) {
    defineProperties(this, {
      [PROXY]: { value: new Proxy(this, proxyHandlers) },
      get: { value: get },
      set: { value: set },
    });
    return proxy;
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Array;
}

export function makeArrayReadOnly() {
  makeReadOnly.call(this);
  Object.defineProperty(this, 'set', { value: throwReadOnly });
  const get = this.get;
  const getReadOnly = function(index) {
    const element = get.call(this, index);
    if (element?.[CONST_TARGET] === null) {
      element[PROTECTOR]?.();
    }
    return element;
  };
  Object.defineProperty(this, 'get', { value: getReadOnly });
}

export function canBeString(member) {
  return member.type === MemberType.Uint && [ 8, 16 ].includes(member.bitSize);
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
        child[VISITOR](cb, childOptions);
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
    } else if (name === SELF) {
      return array;
    } else {
      return array[name];
    }
  },
  set(array, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      array.set(index, value);
    } else {
      array[name] = value;
    }
    return true;
  },
  deleteProperty(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      delete array[name];
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
