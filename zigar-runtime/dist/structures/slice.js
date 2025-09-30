import { SliceFlag, StructureFlag, VisitorFlag, ProxyType } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidArrayInitializer, ArrayLengthMismatch } from '../errors.js';
import { getProxy } from '../proxies.js';
import { SENTINEL, MEMORY, VISIT, ENTRIES, SHAPE, INITIALIZE, FINALIZE, VIVIFICATE, PROXY, PROXY_TYPE, LENGTH } from '../symbols.js';
import { defineValue, isCompatibleInstanceOf, copyObject, transformIterable, copyView } from '../utils.js';

var slice = mixin({
  defineSlice(structure, descriptors) {
    const {
      align,
      flags,
      instance: {
        members: [ member ],
      },
    } = structure;
    const { byteSize: elementSize } = member;
    const thisEnv = this;
    const shapeDefiner = function(dv, length, allocator) {
      if (!dv) {
        dv = thisEnv.allocateMemory(length * elementSize, align, allocator);
      }
      this[MEMORY] = dv;
      this[LENGTH] = length;
    };
    const shapeChecker = function(arg, length) {
      if (length !== this[LENGTH]) {
        throw new ArrayLengthMismatch(structure, this, arg);
      }
    };
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    // the initializer behave differently depending on whether it's called by the
    // constructor or by a member setter (i.e. after object's shape has been established)
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, allocator);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else if (typeof(arg) === 'string' && flags & SliceFlag.IsString) {
        initializer.call(this, { string: arg }, allocator);
      } else if (arg?.[Symbol.iterator]) {
        arg = transformIterable(arg);
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, allocator);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        let i = 0;
        for (const value of arg) {
          constructor[SENTINEL]?.validateValue(value, i, arg.length);
          set.call(this, i++, value, allocator);
        }
      } else if (typeof(arg) === 'number') {
        if (!this[MEMORY] && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg, allocator);
        } else {
          throw new InvalidArrayInitializer(structure, arg, !this[MEMORY]);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg, allocator) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    });
    const getSubArrayView = function(begin, end) {
      const length = this[LENGTH];
      const dv = this[MEMORY];
      begin = (begin === undefined) ? 0 : adjustIndex(begin, length);
      end = (end === undefined) ? length : adjustIndex(end, length);
      const offset = begin * elementSize;
      const len = (end * elementSize) - offset;
      return thisEnv.obtainView(dv.buffer, dv.byteOffset + offset, len);
    };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { 
      get: function() { return getProxy(this, ProxyType.Slice) },
      set: initializer 
    };
    descriptors.length = { get: getLength };
    if (flags & SliceFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & SliceFlag.IsString) {
        descriptors.string = this.defineString(structure);
      }
      if (flags & SliceFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors.entries = descriptors[ENTRIES] = this.defineArrayEntries();
    descriptors.subarray = {
      value(begin, end) {
        const dv = getSubArrayView.call(this, begin, end);
        return constructor(dv);
      },
    };
    descriptors.slice = {
      value(begin, end, options = {}) {
        const {
          zig = false
        } = options;
        const dv1 = getSubArrayView.call(this, begin, end);
        const dv2 = thisEnv.allocateMemory(dv1.byteLength, align, zig);
        const slice = constructor(dv2);
        copyView(dv2, dv1);
        return slice;
      },
    };
    descriptors[Symbol.iterator] = this.defineArrayIterator();
    descriptors[SHAPE] = defineValue(shapeDefiner);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
    descriptors[PROXY] = {
      value() {
        return getProxy(this, ProxyType.Slice);
      }
    };    
    descriptors[PROXY_TYPE] = defineValue(ProxyType.Slice);
    return constructor;
  },
  finalizeSlice(structure, staticDescriptors) {
    const {
      flags,
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
    staticDescriptors[SENTINEL] = (flags & SliceFlag.HasSentinel) && this.defineSentinel(structure);
  },
});

function getLength() {
  return this[LENGTH];
}

function adjustIndex(index, len) {
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
}

export { slice as default };
