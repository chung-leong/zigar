import { getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory, getPointerAlign } from './memory.js';
import { requireDataView, addTypedArray, getCompatibleTags } from './data-view.js';
import { addSpecialAccessors } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch, throwNoInitializer } from './error.js';
import { MEMORY, COMPAT } from './symbol.js';
import { getSelf } from './struct.js';

export function finalizeVector(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    options,
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
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.allocMemory(byteSize, ptrAlign);
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
  const { bitSize: elementBitSize, structure: elementStructure } = member;
  const copy = getMemoryCopier(byteSize);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
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
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
    const { get, set } = getAccessors({ ...member, bitOffset }, options);
    Object.defineProperty(constructor.prototype, i, { get, set, configurable: true });
  }
  Object.defineProperties(constructor.prototype, {
    length: { value: length, configurable: true },
    $: { get: getSelf, set: initializer, configurable: true },
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
