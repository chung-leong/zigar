import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer } from '../errors.js';
import { getVectorEntries, getVectorIterator } from '../iterators.js';
import { getSelf } from '../object.js';
import { COPY, ENTRIES } from '../symbols.js';

export default mixin({
  defineVector(structure, descriptors) {
    const {
      length,
      instance: { members: [ member ] },
    } = structure;
    if (process.env.DEV) {
      /* c8 ignore start */
      if (member.bitOffset !== undefined) {
        throw new Error(`bitOffset must be undefined for vector member`);
      }
      if (member.slot !== undefined) {
        throw new Error(`slot must be undefined for vector member`);
      }
      /* c8 ignore end */
    }
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
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
          this[i++] = value;
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    };
    const constructor = this.createConstructor(structure, { initializer });
    const { bitSize: elementBitSize } = member;
    for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
      descriptors[i] = this.defineMember({ ...member, bitOffset });
    }
    descriptors.$ = { get: getSelf, set: initializer };
    descriptors.length = { value: length };
    descriptors.entries = { value: getVectorEntries };
    descriptors[Symbol.iterator] = { value: getVectorIterator };
    descriptors[ENTRIES] = { get: getVectorEntries };
    return constructor;
  },
});


