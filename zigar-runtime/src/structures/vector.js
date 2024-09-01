import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer } from '../errors.js';
import { getSelf } from '../object.js';
import { COPIER, ENTRIES_GETTER, PROP_SETTERS } from '../symbols.js';
import { getTypedArrayClass } from './all.js';

export default mixin({
  defineVector(structure) {
    const {
      length,
      byteSize,
      align,
      instance: { members: [ member ] },
    } = structure;
    /* c8 ignore start */
    if (process.env.DEV) {
      if (member.bitOffset !== undefined) {
        throw new Error(`bitOffset must be undefined for vector member`);
      }
      if (member.slot !== undefined) {
        throw new Error(`slot must be undefined for vector member`);
      }
    }
    /* c8 ignore end */
    const { bitSize: elementBitSize, structure: elementStructure } = member;
    const elementDescriptors = {};
    for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
      const { get, set } = this.getDescriptor({ ...member, bitOffset });
      elementDescriptors[i] = { get, set, configurable: true };
    }
    const propApplier = this.createPropertyApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPIER](arg);
      } else if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throw new ArrayLengthMismatch(structure, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          this[PROP_SETTERS][i++].call(this, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    };
    const constructor = structure.constructor = this.createConstructor(structure, { initializer });
    const instanceDescriptors = {
      ...elementDescriptors,
      $: { get: getSelf, set: initializer },
      length: { value: length },
      entries: { value: getVectorEntries },
      [Symbol.iterator]: { value: getVectorIterator },
      [ENTRIES_GETTER]: { value: getVectorEntries },
    };
    const staticDescriptors = {
      child: { get: () => elementStructure.constructor },
    };
    structure.TypedArray = getTypedArrayClass(member);
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  },
});

export function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self[current];
        done = false;
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
        const current = index++;
        value = [ current, self[current] ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}
