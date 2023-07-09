import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { getTypedArrayClass, addTypedArrayAccessor } from './typed-array.js';
import {
  createChildObjects,
  getPointerCopier,
  getPointerResetter,
  getArrayLengthGetter,
  getArrayIterator
} from './array.js';
import { addStringAccessors } from './string.js';
import { addJSONHandlers } from './json.js';
import { throwInvalidArrayInitializer } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';

export function finalizeSlice(s) {
  const {
    size: elementSize,
    instance: {
      members: [ member ],
    },
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
  const TypedArray = getTypedArrayClass(member);
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      initializer.call(this, arg);
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg, TypedArray);
      Object.defineProperties(self, {
        [MEMORY]: { value: dv, configurable: true },
      });
      if (objectMember) {
        createChildObjects.call(self, objectMember, 0, this, dv);
      }
      return self;
    }
  };
  const copy = getMemoryCopier(elementSize);
  const initializer = s.initializer = function(arg) {
    let count;
    if (Array.isArray(arg) || (TypedArray && arg instanceof TypedArray) || arg instanceof constructor) {
      count = arg.length;
    } else if (typeof(arg) === 'number') {
      count = arg;
    } else {
      throwInvalidArrayInitializer(s, arg);
    }
    let dv = this[MEMORY];
    const size = elementSize * count;
    const currentSize = this?.byteLength ?? 0;
    if (size !== currentSize) {
      dv = new DataView(new ArrayBuffer(size));
      Object.defineProperties(this, {
        [MEMORY]: { value: dv, configurable: true },
      });
    }
    if (objectMember) {
      if (size > currentSize) {
        createChildObjects.call(this, objectMember, currentSize, this, dv);
      } else if (size < currentSize) {
        clearChildObjects.call(this, currentSize, size);
      }
    }
    if (arg instanceof constructor) {
      copy(dv, arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (Array.isArray(arg) || (TypedArray && arg instanceof TypedArray)) {
        for (let i = 0, len = arg.length; i < len; i++) {
          set.call(this, i, arg[i]);
        }
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMember);
  const pointerResetter = s.pointerResetter = getPointerResetter(objectMember);
  const { get, set } = getAccessors(member, options);
  const getLength = getArrayLengthGetter(elementSize);
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

function clearChildObjects(startSlot, endSlot) {
  const destSlots = this[SLOTS];
  for (let i = startSlot; i < endSlot; i++) {
    destSlots[i] = null;
  }
}
