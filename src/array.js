import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { getTypedArrayClass, addTypedArrayAccessor, isTypedArray } from './typed-array.js';
import { addStringAccessors } from './string.js';
import { addJSONHandlers } from './json.js';
import { throwInvalidArrayInitializer, throwArraySizeMismatch } from './error.js';
import { MEMORY, SLOTS, ZIG } from './symbol.js';

export function finalizeArray(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  if (process.env.NODE_DEV !== 'production') {
    /* c8 ignore next 6 */
    if (member.bitOffset !== undefined) {
      throw new Error(`bitOffset must be undefined for array member`);
    }
    if (member.slot !== undefined) {
      throw new Error(`slot must be undefined for array member`);
    }
  }
  const TypedArray = s.TypedArray = getTypedArrayClass(member);
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    if (objectMember) {
      createChildObjects.call(self, objectMember, 0, this, dv);
    }
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const { byteSize } = member;
  const count = size / byteSize;
  const copy = getMemoryCopier(size);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (Array.isArray(arg) || isTypedArray(arg, TypedArray)) {
        const len = arg.length;
        if (len !== count) {
          throwArraySizeMismatch(s, count, arg);
        }
        for (let i = 0; i < len; i++) {
          set.call(this, i, arg[i]);
        }
      } else {
        console.log({ arg })
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMember);
  const pointerResetter = s.pointerResetter = getPointerResetter(objectMember);
  const { get, set } = getAccessors(member, options);
  const length = size / member.byteSize;
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { value: length, configurable: true },
    $: { get: retriever, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  addDataViewAccessor(s);
  addTypedArrayAccessor(s);
  addStringAccessors(s);
  addJSONHandlers(s);
  return constructor;
}

export function createChildObjects(member, startOffset, recv, dv) {
  let slots = this[SLOTS];
  if (!slots) {
    slots = {};
    Object.defineProperties(this, {
      [SLOTS]: { value: slots },
    });
  }
  const { structure: { constructor }, byteSize } = member;
  if (recv !== ZIG) {
    recv = null;
  }
  const startSlot = (startOffset) ? startOffset / byteSize : 0;
  for (let slot = startSlot, offset = startOffset, len = dv.byteLength; offset < len; slot++, offset += byteSize) {
    const childDV = new DataView(dv.buffer, offset, byteSize);
    slots[slot] = constructor.call(recv, childDV);
  }
}

export function getPointerCopier(member) {
  if (!member?.structure.hasPointer) {
    return null;
  }
  return function(src) {
    const { structure: { pointerCopier }, byteSize } = member;
    const dv = this[MEMORY];
    const destSlots = dest[SLOTS];
    const srcSlots = src[SLOTS];
    for (let slot = 0, offset = 0, len = dv.byteLength; offset < len; slot++, offset += byteSize) {
      pointerCopier.call(destSlots[slot], srcSlots[slot]);
    }
  };
}

export function getPointerResetter(member) {
  if (!member?.structure.hasPointer) {
    return null;
  }
  return function(src) {
    const { structure: { pointerResetter }, byteSize } = member;
    const dv = this[MEMORY];
    const destSlots = dest[SLOTS];
    for (let slot = 0, offset = 0, len = dv.byteLength; offset < len; slot++, offset += byteSize) {
      pointerResetter.call(destSlots[slot]);
    }
  };
}

export function getArrayLengthGetter(size) {
  const shift = getShift(size);
  if (shift !== undefined) {
    // use shift where possible
    return function() {
      return this[MEMORY].byteLength >> shift;
    };
  } else {
    return function() {
      return this[MEMORY].byteLength / size;
    };
  }
}

function getShift(size) {
  for (let i = 0, j = 2 ** i; j <= size; i++, j = 2 ** i) {
    if (j === size) {
      return i;
    }
  }
}

export function getArrayIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self.get(index);
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

