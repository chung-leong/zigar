import { ObjectCache, defineProperties, getSelf, removeSetters } from './structure.js';
import { getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { requireDataView, addTypedArray, getCompatibleTags } from './data-view.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch, throwNoInitializer, throwReadOnly } from './error.js';
import { ALIGN, COMPAT, CONST, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';

export function defineVector(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = s;
  addTypedArray(s);
  /* DEV-TEST */
  /* c8 ignore next 6 */
  if (member.bitOffset !== undefined) {
    throw new Error(`bitOffset must be undefined for vector member`);
  }
  if (member.slot !== undefined) {
    throw new Error(`slot must be undefined for vector member`);
  }
  /* DEV-TEST-END */
  const cache = new ObjectCache();
  const constructor = s.constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.allocateMemory(byteSize, align, fixed);
    } else {
      dv = requireDataView(s, arg, env);
      if (self = cache.find(dv, writable)) {
        return self;
      }
      self = Object.create(constructor.prototype);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    }
    if (!writable) {
      defineProperties(self, {
        ...removeSetters(elementDescriptors),
        $: { get: getSelf, set: throwReadOnly, configurable: true },
        [CONST]: { value: true, configurable: true },
      });
    }
    return cache.save(dv, writable, self);
  };
  const { bitSize: elementBitSize, structure: elementStructure } = member;
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
    } else {
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
          this[i++] = value;
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const elementDescriptors = {};
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
    const { get, set } = getDescriptor({ ...member, bitOffset }, env);
    elementDescriptors[i] = { get, set, configurable: true };
  }
  defineProperties(constructor.prototype, {
    ...elementDescriptors,
    length: { value: length, configurable: true },
    entries: { value: createVectorEntries, configurable: true, writable: true },
    delete: { value: getDestructor(s), configurable: true },
    $: { get: getSelf, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getVectorIterator, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}

export function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self[index];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getVectorEntriesIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = [ index, self[index] ];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function createVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}
