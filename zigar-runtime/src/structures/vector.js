import { StructureFlag, VectorFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer } from '../errors.js';
import { getVectorEntries, getVectorIterator } from '../iterators.js';
import { COPY, ENTRIES, INITIALIZE, VISIT, VIVIFICATE } from '../symbols.js';
import { defineValue, getSelf } from '../utils.js';

export default mixin({
  defineVector(structure, descriptors) {
    const {
      flags,
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
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
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
      if (flags & StructureFlag.HasPointer) {
        descriptors[i] = this.defineMember({ ...member, slot: i });
      } else {
        descriptors[i] = this.defineMember({ ...member, bitOffset });
      }
    }
    descriptors.$ = { get: getSelf, set: initializer };
    descriptors.length = defineValue(length);
    if (flags & VectorFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & VectorFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors.entries = defineValue(getVectorEntries);
    descriptors[Symbol.iterator] = defineValue(getVectorIterator);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[ENTRIES] = { get: getVectorEntries };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
    return constructor;
  },
  finalizeVector(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
  },
});
