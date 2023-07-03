import { MemberType } from "./member.js";
import { getAccessors } from "./member.js";

export function finalizePrimitive(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const primitive = getPrimitive(member.type, member.bitSize);
  const copy = getCopyFunction(size);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation--expect matching primitive
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    if (creating) {
      if (primitive !== undefined) {
        if (arg !== undefined) {
          this.set(primitive(arg));
        }
      }
    } else {
      return self;
    }
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
  });
  attachName(s);
  return constructor;
}

export function getIntRange({ isSigned, bitSize }) {
  if (bitSize <= 32) {
    const max = 2 ** (isSigned ? bitSize - 1 : bitSize) - 1;
    const min = (isSigned) ? -(2 ** (bitSize - 1)) : 0;
    return { min, max };
  } else {
    bitSize = BigInt(bitSize);
    const max = 2n ** (isSigned ? bitSize - 1n : bitSize) - 1n;
    const min = (isSigned) ? -(2n ** (bitSize - 1n)) : 0n;
    return { min, max };
  }
}

export function getPrimitiveClass({ type, bitSize }) {
  if (type === MemberType.Int) {
    if (bitSize <= 32) {
      return Number;
    } else {
      return BigInt;
    }
  } else if (type === MemberType.Float) {
    return Number;
  } else if (type === MemberType.Bool) {
    return Boolean;
  }
}

export function isExtendedType({ type, bitSize, byteSize }) {
  if (type === MemberType.Int) {
    if (byteSize === 0) {
      return true;
    } else {
      return !(bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64);
    }
  } else if (type === MemberType.Float) {
    if (byteSize === 0) {
      return true;
    } else {
      return !(bitSize === 32 || bitSize === 64);
    }
  }
  return false;
}