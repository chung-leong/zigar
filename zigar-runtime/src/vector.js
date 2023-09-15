import { getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { requireDataView, addTypedArray, isTypedArray, getCompatibleTags } from './data-view.js';
import { addSpecialAccessors } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch, throwNoInitializer } from './error.js';
import { MEMORY, COMPAT } from './symbol.js';

export function finalizeVector(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  if (process.env.ZIGAR_DEV) {
    /* c8 ignore next 6 */
    if (member.bitOffset !== undefined) {
      throw new Error(`bitOffset must be undefined for vector member`);
    }
    if (member.slot !== undefined) {
      throw new Error(`slot must be undefined for vector member`);
    }
  }
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const { byteSize: elementSize, structure: elementStructure } = member;
  const length = size / elementSize;
  const copy = getMemoryCopier(size);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
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
      } else {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const retriever = function() { return this };
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementSize * 8) {
    const { get, set } = getAccessors({ ...member, bitOffset }, options);
    Object.defineProperty(constructor.prototype, i, { get, set, configurable: true });
  }
  Object.defineProperties(constructor.prototype, {
    length: { value: length, configurable: true },
    $: { get: retriever, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getVectorIterator, configurable: true, writable: true },
    entries: { value: createVectorEntries, configurable: true, writable: true },
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
  });
  addSpecialAccessors(s);
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
