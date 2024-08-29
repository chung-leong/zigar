import {
  canBeString, createArrayProxy, getArrayEntries, getArrayIterator, getChildVivificator,
  getPointerVisitor, makeArrayReadOnly, transformIterable
} from '../../array.js';
import { getCompatibleTags, getTypedArrayClass } from '../../data-view.js';
import {
  ArrayLengthMismatch, InvalidArrayInitializer
} from '../../error.js';
import { getMemoryCopier } from '../../memory.js';
import { createPropertyApplier } from '../../object.js';
import { copyPointer, getProxy } from '../../pointer.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getStringDescriptor,
  getTypedArrayDescriptor, getValueOf
} from '../../special.js';
import {
  ALIGN, COMPAT, COPIER, ENTRIES_GETTER, LENGTH,
  MEMORY, POINTER_VISITOR, SIZE, TYPE,
  VIVIFICATOR, WRITE_DISABLER
} from '../../symbol.js';
import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';
import { StructureType } from './all.js';

mixin({
  defineSlice(structure) {
    const {
      align,
      instance: {
        members: [ member ],
      },
      byteSize,
      hasPointer,
    } = structure;
    const thisEnv = this;
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
    const { get, set } = this.getDescriptor(member);
    const { byteSize: elementSize, structure: elementStructure } = member;
    const sentinel = this.getSentinel(structure);
    if (sentinel) {
      // zero-terminated strings aren't expected to be commonly used
      // so we're not putting this prop into the standard structure
      structure.sentinel = sentinel;
    }
    const hasStringProp = canBeString(member);
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
    const propApplier = createPropertyApplier(structure);
    const initializer = function(arg, fixed = false) {
      if (arg instanceof constructor) {
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, fixed);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        this[COPIER](arg);
        if (hasPointer) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      } else if (typeof(arg) === 'string' && hasStringProp) {
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
    const getLength = function() {
      return this[LENGTH];
    };
    const adjustIndex = function(index, len) {
      index = index | 0;
      if (index < 0) {
        index = len + index;
        if (index < 0) {
          index = 0;
        }
      } else {
        if (index > len) {
          index = len;
        }
      }
      return index;
    };
    function getSubArrayView(begin, end) {
      begin = (begin === undefined) ? 0 : adjustIndex(begin, this.length);
      end = (end === undefined) ? this.length : adjustIndex(end, this.length);
      const dv = this[MEMORY];
      const offset = begin * elementSize;
      const len = (end * elementSize) - offset;
      return thisEnv.obtainView(dv.buffer, dv.byteOffset + offset, len);
    }
    function getSubarrayOf(begin, end) {
      const dv = getSubArrayView.call(this, begin, end);
      return constructor(dv);
    };
    const getSliceOf = function(begin, end, options = {}) {
      const {
        fixed = false
      } = options;
      const dv1 = getSubArrayView.call(this, begin, end);
      const dv2 = thisEnv.allocateMemory(dv1.byteLength, align, fixed);
      const slice = constructor(dv2);
      copier.call(slice, { [MEMORY]: dv1 });
      return slice;
    };
    const finalizer = createArrayProxy;
    const copier = getMemoryCopier(elementSize, true);
    const constructor = structure.constructor = this.createConstructor(structure, { initializer, shapeDefiner, finalizer });
    const typedArray = structure.typedArray = getTypedArrayClass(member);
    const hasObject = member.type === MemberType.Object;
    const shapeHandlers = { shapeDefiner };
    const instanceDescriptors = {
      $: { get: getProxy, set: initializer },
      length: { get: getLength },
      dataView: getDataViewDescriptor(structure, shapeHandlers),
      base64: getBase64Descriptor(structure, shapeHandlers),
      string: hasStringProp && getStringDescriptor(structure, shapeHandlers),
      typedArray: typedArray && getTypedArrayDescriptor(structure, shapeHandlers),
      get: { value: get },
      set: { value: set },
      entries: { value: getArrayEntries },
      slice: { value: getSliceOf },
      subarray: { value: getSubarrayOf },
      valueOf: { value: getValueOf },
      toJSON: { value: convertToJSON },
      delete: { value: this.getDestructor() },
      [Symbol.iterator]: { value: getArrayIterator },
      [ENTRIES_GETTER]: { value: getArrayEntries },
      [COPIER]: { value: copier },
      [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, this, true) },
      [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure) },
      [WRITE_DISABLER]: { value: makeArrayReadOnly },
    };
    const staticDescriptors = {
      child: { get: () => elementStructure.constructor },
      [COMPAT]: { value: getCompatibleTags(structure) },
      [ALIGN]: { value: align },
      [SIZE]: { value: byteSize },
      [TYPE]: { value: structure.type },
    };
    this.attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Slice;
}
