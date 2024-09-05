import { StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer } from '../errors.js';
import { getArrayEntries, getArrayIterator } from '../iterators.js';
import {
  COPY, ENTRIES, FINALIZE, INITIALIZE, LENGTH, MEMORY, SHAPE, VISIT, VIVIFICATE
} from '../symbols.js';
import { defineValue, getProxy, transformIterable } from '../utils.js';

export default mixin({
  defineSlice(structure, descriptors) {
    const {
      align,
      instance: {
        members: [ member ],
      },
      flags,
    } = structure;
    /* c8 ignore start */
    if (process.env.DEV) {
      if (member.bitOffset !== undefined) {
        throw new Error(`bitOffset must be undefined for slice member`);
      }
      if (member.slot !== undefined) {
        throw new Error(`slot must be undefined for slice member`);
      }
    }
    /* c8 ignore end */
    const { byteSize: elementSize, structure: elementStructure } = member;
    // method will not exist when there're no sentinels
    const sentinel = this.getSentinel?.(structure);
    if (sentinel) {
      // zero-terminated strings aren't expected to be commonly used
      // so we're not putting this prop into the standard structure
      structure.sentinel = sentinel;
    }
    const thisEnv = this;
    const shapeDefiner = function(dv, length, fixed = false) {
      if (!dv) {
        dv = thisEnv.allocateMemory(length * elementSize, align, fixed);
      }
      this[MEMORY] = dv;
      this[LENGTH] = length;
    };
    const shapeChecker = function(arg, length) {
      if (length !== this[LENGTH]) {
        throw new ArrayLengthMismatch(structure, this, arg);
      }
    };
    // the initializer behave differently depending on whether it's called by the
    // constructor or by a member setter (i.e. after object's shape has been established)
    const propApplier = this.createApplier(structure);
    const initializer = function(arg, fixed = false) {
      if (arg instanceof constructor) {
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, fixed);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
        }
      } else if (typeof(arg) === 'string' && flags & StructureFlag.IsString) {
        initializer.call(this, { string: arg }, fixed);
      } else if (arg?.[Symbol.iterator]) {
        arg = transformIterable(arg);
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, fixed);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        let i = 0;
        for (const value of arg) {
          sentinel?.validateValue(value, i, arg.length);
          set.call(this, i++, value);
        }
      } else if (typeof(arg) === 'number') {
        if (!this[MEMORY] && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg, fixed);
        } else {
          throw new InvalidArrayInitializer(structure, arg, !this[MEMORY]);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg, fixed) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    };
    const descriptor = this.defineMember(member);
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.entries = defineValue(getArrayEntries);
    descriptors.slice = null; // TODO
    descriptors.subarray = null; // TODO
    descriptors[Symbol.iterator] = defineValue(getArrayIterator);
    descriptors[SHAPE] = defineValue(shapeDefiner);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[ENTRIES] = { get: getArrayEntries };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray(structure);
    return constructor;
  },
  finalizeSlice(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Slice;
}
