import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getCopyFunction } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { addTypedArrayAccessor } from './typed-array.js';
import { addStringAccessors } from './string.js';
import { MEMORY, SLOTS, ZIG } from './symbol.js';

export function finalizeArray(s) {
  const {
    type,
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
  const copy = getCopyFunction(size);
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const copier = s.copier = function(dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (objectMember) {
      dest[SLOTS] = { ...src[SLOTS] };
    }
  };
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
      const slots = {};
      const { structure: { constructor }, byteSize } = objectMember;
      const recv = (this === ZIG) ? this : null;
      for (let slot = 0, offset = 0, len = dv.byteLength; offset < len; slot++, offset += byteSize) {
        const childDV = new DataView(dv.buffer, offset, byteSize);
        slots[slot] = constructor.call(recv, childDV);
      }
      Object.defineProperties(self, {
        [SLOTS]: { value: slots, writable: true },
      });
    }
    if (creating) {
      // expect an array
      // TODO: validate and set memory
    } else {
      return self;
    }
  };
  const { get, set } = getAccessors(member, options);
  let lengthDescriptor;
  if (type == StructureType.Slice) {
    const get = getArrayLengthGetter(size);
    lengthDescriptor = { get, configurable: true };
  } else {
    const length = size / member.byteSize;
    lengthDescriptor = { value: length, configurable: true };
  }
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: lengthDescriptor,
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  addDataViewAccessor(s);
  addTypedArrayAccessor(s);
  addStringAccessors(s);
  return constructor;
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

