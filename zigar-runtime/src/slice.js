import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { requireDataView, getTypedArrayClass, isTypedArray } from './data-view.js';
import {
  createChildObjects,
  getPointerCopier,
  getPointerResetter,
  getPointerDisabler,
  getArrayIterator,
  createProxy,
} from './array.js';
import { addSpecialAccessors } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch } from './error.js';
import { LENGTH, MEMORY, ELEMENT } from './symbol.js';

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
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const { byteSize: elementSize, structure: elementStructure } = member;
  const typedArray = s.typedArray = getTypedArrayClass(member);
  const getCount = (arg) => {
    if (Array.isArray(arg) || isTypedArray(arg, typedArray) || arg instanceof constructor) {
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
      dv = requireDataView(s, arg, typedArray);
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
      throwArrayLengthMismatch(s, arg);
    }
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (Array.isArray(arg) || isTypedArray(arg, typedArray)) {
        for (let i = 0; i < count; i++) {
          set.call(this, i, arg[i]);
        }
      } else {
        for (let i = 0; i < count; i++) {
          set.call(this, i, undefined);
        }
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = (hasPointer) ? getPointerCopier(objectMember) : null;
  const pointerResetter = s.pointerResetter = (hasPointer) ? getPointerResetter(objectMember) : null;
  const pointerDisabler = s.pointerDisabler = (hasPointer) ? getPointerDisabler(objectMember) : null;
  const { get, set } = getAccessors(member, options);
  const getLength = function() { return this[LENGTH] };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    $: { get: retriever, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  Object.defineProperty(constructor, ELEMENT, { get: () => elementStructure.constructor });
  addSpecialAccessors(s);
  return constructor;
}
