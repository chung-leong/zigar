import { StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { ArrayLengthMismatch, InvalidArrayInitializer } from '../errors.js';
import { copyPointer, getProxy } from '../pointer.js';
import { COPY, ENTRIES, FINALIZE, TYPED_ARRAY, VISIT, VIVIFICATE } from '../symbols.js';
import { defineValue } from '../utils.js';

export default mixin({
  defineArray(structure, descriptors) {
    const {
      length,
      instance: { members: [ member ] },
      flags,
    } = structure;
    if (process.env.DEV) {
      /* c8 ignore start */
      if (member.bitOffset !== undefined) {
        throw new Error(`bitOffset must be undefined for array member`);
      }
      if (member.slot !== undefined) {
        throw new Error(`slot must be undefined for array member`);
      }
      /* c8 ignore end */
    }
    const propApplier = this.createApplier(structure);
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    const constructor = this.createConstructor(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT](copyPointer, { vivificate: true, source: arg });
        }
      } else {
        if (typeof(arg) === 'string' && flags & StructureFlag.IsString) {
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
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.length = defineValue(length);
    descriptors.entries = defineValue(getArrayEntries);
    descriptors[Symbol.iterator] = defineValue(getArrayIterator);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizer(descriptor);
    descriptors[ENTRIES] = { get: getArrayEntries };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray(structure);
    return constructor;
  },
  finalizeArray(structure, descriptors, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors[TYPED_ARRAY] = defineValue(member.structure.constructor[TYPED_ARRAY]);
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Array;
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
