import { MemberType, isByteAligned, getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { getCompatibleTags, addTypedArray, requireDataView } from './data-view.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { MEMORY, COMPAT } from './symbol.js';
import { throwInvalidInitializer, throwNoInitializer, throwNoProperty } from './error.js';

export function finalizePrimitive(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
    } else {
      if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        for (const key of keys) {
          if (!specialKeys.includes(key)) {
            throwNoProperty(s, key);
          }
        }
        if (!keys.some(k => specialKeys.includes(k))) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(s, type, arg);
        }
        for (const key of keys) {
          this[key] = arg[key];
        }
      } else if (arg !== undefined) {
        this.$ = arg;
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    $: { get, set, configurable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
  });
  Object.defineProperty(constructor, COMPAT, { value: getCompatibleTags(s) });
  addSpecialAccessors(s);
  return constructor;
};

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

export function getPrimitiveType(member) {
  const Primitive = getPrimitiveClass(member);
  if (Primitive) {
    return typeof(Primitive(0));
  }
}

export function isExtendedType(member) {
  if (!isByteAligned(member)) {
    return true;
  }
  const { type, bitSize } = member;
  if (type === MemberType.Int || type === MemberType.EnumerationItem) {
    return !(bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64);
  } else if (type === MemberType.Float) {
    return !(bitSize === 32 || bitSize === 64);
  } else {
    return false;
  }
}
