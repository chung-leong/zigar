import { getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { requireDataView, getTypedArrayClass, isTypedArray, getCompatibleTags } from './data-view.js';
import { addSpecialAccessors } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch } from './error.js';
import { MEMORY, COMPAT } from './symbol.js';

export function finalizeVector(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  if (process.env.NODE_DEV !== 'production') {
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
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
    });
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const { byteSize: elementSize, structure: elementStructure } = member;
  const count = size / elementSize;
  const copy = getMemoryCopier(size);
  const typedArray = s.typedArray = getTypedArrayClass(member);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
    } else {
      if (Array.isArray(arg) || isTypedArray(arg, typedArray)) {
        const len = arg.length;
        if (len !== count) {
          throwArrayLengthMismatch(s, arg);
        }
        for (let i = 0; i < len; i++) {
          this[i] = arg[i];
        }
      } else {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const retriever = function() { return this };
  const elementDescriptors = {};
  for (let i = 0, bitOffset = 0; i < count; i++, bitOffset += elementSize * 8) {
    const { get, set } = getAccessors({ ...member, bitOffset }, options);
    elementDescriptors[i] = { get, set, configurable: true };
  }
  Object.defineProperties(constructor.prototype, {
    ...elementDescriptors,
    length: { value: count, configurable: true },
    $: { get: retriever, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getVectorIterator, configurable: true },
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(member) },
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
