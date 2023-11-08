import { defineProperties } from './structure.js';
import { MemberType, isByteAligned, getAccessors } from './member.js';
import { getMemoryCopier, getPointerAlign } from './memory.js';
import { getCompatibleTags, addTypedArray, requireDataView } from './data-view.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { MEMORY, COMPAT, MEMORY_COPIER } from './symbol.js';
import { throwInvalidInitializer, throwNoInitializer, throwNoProperty } from './error.js';

export function finalizePrimitive(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
    } else {
      if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(s, type, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            this[key] = arg[key];
          }
        }
      } else if (arg !== undefined) {
        this.$ = arg;
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  defineProperties(constructor.prototype, {
    $: { get, set, configurable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    [COMPAT]: { value: getCompatibleTags(s) },
  });
  addSpecialAccessors(s);
  return constructor;
};

export function getIntRange(member) {
  const { type, bitSize } = member;
  const signed = (type === MemberType.Int);
  let magBits = (signed) ? bitSize - 1 : bitSize;
  if (bitSize <= 32) {
    const max = 2 ** magBits - 1;
    const min = (signed) ? -(2 ** magBits) : 0;
    return { min, max };
  } else {
    magBits = BigInt(magBits);
    const max = 2n ** magBits - 1n;
    const min = (signed) ? -(2n ** magBits) : 0n;
    return { min, max };
  }
}

export function getPrimitiveClass({ type, bitSize }) {
  if (type === MemberType.Int || type === MemberType.Uint) {
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
