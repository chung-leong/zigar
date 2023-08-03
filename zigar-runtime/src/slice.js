import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { getTypedArrayClass, addTypedArrayAccessor, isTypedArray } from './typed-array.js';
import {
  createChildObjects,
  getPointerCopier,
  getPointerResetter,
  getArrayIterator,
  createProxy,
} from './array.js';
import { addStringAccessors } from './string.js';
import { addJSONHandlers } from './json.js';
import { throwInvalidArrayInitializer, throwArraySizeMismatch } from './error.js';
import { LENGTH, MEMORY, SLOTS } from './symbol.js';
import { StructureType } from './structure.js';

export function finalizeSlice(s) {
  const {
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  if (process.env.NODE_DEV !== 'production') {
    /* c8 ignore next 6 */
    if (member.bitOffset !== undefined) {
      throw new Error(`bitOffset must be undefined for slice member`);
    }
    if (member.slot !== undefined) {
      throw new Error(`slot must be undefined for slice member`);
    }
  }
  const TypedArray = s.TypedArray = getTypedArrayClass(member);
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const { byteSize: elementSize } = member;
  const getCount = (arg) => {
    if (Array.isArray(arg) || isTypedArray(arg, TypedArray) || arg instanceof constructor) {
      return arg.length;
    } else if (typeof(arg) === 'number') {
      return arg;
    } else {
      throwInvalidArrayInitializer(s, arg);
    }
  };
  let count;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      count = getCount(arg);
      dv = new DataView(new ArrayBuffer(elementSize * count));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg, TypedArray);
      count = dv.byteLength / elementSize;
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
      [LENGTH]: { value: count },
    });
    if (objectMember) {
      createChildObjects.call(self, objectMember, this, dv);
    }
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy.call(self);
  };
  const copy = getMemoryCopier(elementSize);
  const initializer = s.initializer = function(arg) {
    if (getCount(arg) !== count) {
      throwArraySizeMismatch(s, count, arg);
    }
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (Array.isArray(arg) || isTypedArray(arg, TypedArray)) {
        for (let i = 0, len = arg.length; i < len; i++) {
          set.call(this, i, arg[i]);
        }
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = (hasPointer) ? getPointerCopier(objectMember) : null;
  const pointerResetter = s.pointerResetter = (hasPointer) ? getPointerResetter(objectMember) : null;
  const { get, set } = getAccessors(member, options);
  const getLength = function() { return this[LENGTH] };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    $: { get: retriever, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  addDataViewAccessor(s);
  addTypedArrayAccessor(s);
  addStringAccessors(s);
  addJSONHandlers(s);
  return constructor;
}
