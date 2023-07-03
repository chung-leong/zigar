import { MemberType, getAccessors } from './member.js';
import { getCopyFunction } from './memory.js';
import { MEMORY, SLOTS } from './symbol.js';

export function finalizeArray(s) {
  const {
    type,
    size,
    name,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  if (process.env.NODE_DEV !== 'production') {
    if (member.bitOffset) {
      throw new Error(`bitOffset must be undefined for array member`);
    }
  }
  const copy = getCopyFunction(size);
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const isSlice = type == StructureType.Slice;
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
    if (hasObjects) {
      const slots = {};
      const { structure: { constructor }, byteSize } = objectMember;
      const recv = (this === ZIG) ? this : null;
      for (let slot = 0, offset = 0, len = dv.byteLength; offset < len; slot++, offset += byteSize) {
        const childDV = new DataView(dv.buffer, offset, byteSize);
        slots[slot] = constructor.call(recv, childDV);
      }
      Object.defineProperties(self, {
        [SLOTS]: { value: slots },
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
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  if (getPointer) {
    const ptrSourceProto = Object.defineProperties({}, {
      get: { value: getPointer, configurable: true, writable: true },
      set: { value: setPointer, configurable: true, writable: true },
      length: { get: getPointerLength, configurable: true },
      [Symbol.iterator]: { value: getArrayIterator, configurable: true },
    });
    const get = function() {
      const ptrSource = Object.create(ptrSourceProto);
      ptrSource[SOURCE] = this;
      return ptrSource;
    };
    Object.defineProperties(constructor.prototype, {
      '&': { get, configurable: true, enumerable: true, writable: false }
    });
  }
  return constructor;
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

