import { ArrayFlag, StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer } from '../errors.js';
import { SENTINEL, ENTRIES, INITIALIZE, FINALIZE, VIVIFICATE, VISIT, COPY } from '../symbols.js';
import { defineValue, getProxy, isCompatibleInstanceOf, transformIterable } from '../utils.js';

var array = mixin({
  defineArray(structure, descriptors) {
    const {
      length,
      instance: { members: [ member ] },
      flags,
    } = structure;
    const propApplier = this.createApplier(structure);
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    const constructor = this.createConstructor(structure);
    const initializer = function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else {
        if (typeof(arg) === 'string' && flags & ArrayFlag.IsString) {
          arg = { string: arg };
        }
        if (arg?.[Symbol.iterator]) {
          arg = transformIterable(arg);
          if (arg.length !== length) {
            throw new ArrayLengthMismatch(structure, this, arg);
          }
          let i = 0;
          for (const value of arg) {
            set.call(this, i++, value, allocator);
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
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.length = defineValue(length);
    descriptors.entries = descriptors[ENTRIES] = this.defineArrayEntries();
    if (flags & ArrayFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & ArrayFlag.IsString) {
        descriptors.string = this.defineString(structure);
      }
      if (flags & ArrayFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors[Symbol.iterator] = this.defineArrayIterator();
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
    return constructor;
  },
  finalizeArray(structure, staticDescriptors) {
    const {
      flags,
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
    staticDescriptors[SENTINEL] = (flags & ArrayFlag.HasSentinel) && this.defineSentinel(structure);
  },
});

export { array as default };
