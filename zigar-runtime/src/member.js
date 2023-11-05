import { StructureType } from './structure.js';
import {
  getDataViewBoolAccessor,
  getDataViewBoolAccessorEx,
  getDataViewIntAccessor,
  getDataViewIntAccessorEx,
  getDataViewUintAccessor,
  getDataViewUintAccessorEx,
  getDataViewFloatAccessor,
  getDataViewFloatAccessorEx,
} from './data-view.js';
import { getIntRange } from './primitive.js';
import {
  throwOverflow,
  throwNotNull,
  throwInvalidEnum,
  throwEnumExpected,
  rethrowRangeError,
} from './error.js';
import { restoreMemory } from './memory.js';
import { MEMORY, CHILD_VIVIFICATOR } from './symbol.js';

export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  EnumerationItem: 5,
  Object: 6,
  Type: 7,
  Comptime: 8,
};

const factories = Array(Object.values(MemberType).length);

export function useVoid() {
  factories[MemberType.Void] = getVoidAccessor;
}

export function useBool() {
  factories[MemberType.Bool] = getBoolAccessor;
}

export function useBoolEx() {
  factories[MemberType.Bool] = getBoolAccessorEx;
}

export function useInt() {
  factories[MemberType.Int] = getIntAccessor;
}

export function useIntEx() {
  factories[MemberType.Int] = getIntAccessorEx;
}

export function useUint() {
  factories[MemberType.Uint] = getUintAccessor;
}

export function useUintEx() {
  factories[MemberType.Uint] = getUintAccessorEx;
}

export function useFloat() {
  factories[MemberType.Float] = getFloatAccessor;
}

export function useFloatEx() {
  factories[MemberType.Float] = getFloatAccessorEx;
}

export function useEnumerationItem() {
  factories[MemberType.EnumerationItem] = getEnumerationItemAccessor;
}

export function useEnumerationItemEx() {
  factories[MemberType.EnumerationItem] = getEnumerationItemAccessorEx;
}

export function useObject() {
  factories[MemberType.Object] = getObjectAccessor;
}

export function useType() {
  factories[MemberType.Type] = getTypeAccessor;
}

export function getMemberFeature(member) {
  const { type, bitSize } = member;
  switch (type) {
    case MemberType.Int:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
        return 'useInt';
      } else {
        return 'useIntEx';
      }
    case MemberType.Uint:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
        return 'useUint';
      } else {
        return 'useUintEx';
      }
    case MemberType.EnumerationItem:
      if(isByteAligned(member) && bitSize <= 64) {
        return 'useEnumerationItem';
      } else {
        return 'useEnumerationItemEx';
      }
    case MemberType.Float:
      if (isByteAligned(member) && (bitSize === 32 || bitSize === 64)) {
        return 'useFloat';
      } else {
        return 'useFloatEx';
      }
    case MemberType.Bool:
      if (isByteAligned(member)) {
        return 'useBool';
      } else {
        return 'useBoolEx';
      }
    case MemberType.Object:
      return 'useObject';
    case MemberType.Void:
      return 'useVoid';
    case MemberType.Type:
      return 'useType';
  }
}

export function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

export function getAccessors(member, options = {}) {
  const f = factories[member.type];
  /* DEV-TEST */
  /* c8 ignore next 4 */
  if (typeof(f) !== 'function') {
    const [ name ] = Object.entries(MemberType).find(a => a[1] === member.type);
    throw new Error(`No factory for ${name}: ${member.name}`);
  }
  /* DEV-TEST-END */
  return {
    get: f('get', member, options),
    set: f('set', member, options)
  };
}

export function getVoidAccessor(type, member, options) {
  const { runtimeSafety } = options;
  if (type === 'get') {
    return function() {
      return null;
    };
  } else {
    if (runtimeSafety) {
      return function(value) {
        if (value != null) {
          throwNotNull(member);
        }
      };
      } else {
      return function() {};
    }
  }
}

export function getBoolAccessor(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewBoolAccessor)
}

export function getBoolAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewBoolAccessorEx)
}

export function getIntAccessor(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewIntAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

export function getIntAccessorEx(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewIntAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

export function getUintAccessor(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewUintAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

export function getUintAccessorEx(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewUintAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

function addRuntimeCheck(options, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = options;
    const accessor = getDataViewAccessor(access, member);
    /* DEV-TEST */
    if (!accessor) {
      return;
    }
    /* DEV-TEST-END */
    if (runtimeSafety && access === 'set') {
      const { min, max } = getIntRange(member);
      return function(offset, value, littleEndian) {
        if (value < min || value > max) {
          throwOverflow(member, value);
        }
        accessor.call(this, offset, value, littleEndian);
      };
    }
    return accessor;
  };
}

export function getFloatAccessor(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewFloatAccessor)
}

export function getFloatAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewFloatAccessorEx)
}

export function getEnumerationItemAccessor(access, member, options) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

export function getEnumerationItemAccessorEx(access, member, options) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

function addEnumerationLookup(getDataViewIntAccessor) {
  return function(access, member) {
    // no point in using non-standard int accessor to read enum values unless they aren't byte-aligned
    let { bitSize, byteSize } = member;
    if (byteSize) {
      bitSize = byteSize * 8;
    }
    const intMember = { type: MemberType.Int, bitSize, byteSize };
    const accessor = getDataViewIntAccessor(access, intMember);
    /* DEV-TEST */
    if (!accessor) {
      return;
    }
    /* DEV-TEST-END */
    const { structure } = member;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const { constructor } = structure;
        const value = accessor.call(this, offset, littleEndian);
        // the enumeration constructor returns the object for the int value
        const object = constructor(value);
        if (!object) {
          throwInvalidEnum(structure, value)
        }
        return object;
      };
    } else {
      return function(offset, value, littleEndian) {
        const { constructor } = structure;
        let item;
        if (value instanceof constructor) {
          item = value;
        } else {
          item = constructor(value);
        }
        if (!item) {
          throwEnumExpected(structure, value);
        }
        accessor.call(this, offset, item.valueOf(), littleEndian);
      };
    }
  };
}

export function getObjectAccessor(access, member, options) {
  const { structure, slot } = member;
  let returnValue = false;
  switch (structure.type) {
    case StructureType.ErrorUnion:
    case StructureType.Optional:
      returnValue = true;
      break;
  }
  if (slot !== undefined) {
    if (access === 'get') {
      if (returnValue) {
        return function getValue() {
          const object = this[CHILD_VIVIFICATOR][slot].call(this);
          return object.$;
        };
      } else {
        return function getObject() {
          const object = this[CHILD_VIVIFICATOR][slot].call(this);
          return object;
        };
      }
    } else {
      return function setValue(value) {
        const object = this[CHILD_VIVIFICATOR][slot].call(this);
        object.$ = value;
      };
    }
  } else {
    // array accessors
    if (access === 'get') {
      if (returnValue) {
        return function getValue(index) {
          const object = this[CHILD_VIVIFICATOR](index);
          return object.$;
        };
      } else {
        return function getObject(index) {
          const object = this[CHILD_VIVIFICATOR](index);
          return object;
        };
      }
    } else {
      return function setValue(index, value) {
        const object = this[CHILD_VIVIFICATOR](index);
        object.$ = value;
      };
    }
  }
}

export function getTypeAccessor(type, member, options) {
  const { structure } = member;
  if (type === 'get') {
    return function() {
      const { constructor } = structure;
      return constructor;
    };
  } else {
    // no setter
  }
}

function getAccessorUsing(access, member, options, getDataViewAccessor) {
  const {
    littleEndian = true,
  } = options;
  const { bitOffset, byteSize } = member;
  const accessor = getDataViewAccessor(access, member);
  /* DEV-TEST */
  /* c8 ignore next 3 */
  if (!accessor) {
    return;
  }
  /* DEV-TEST-END */
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    if (access === 'get') {
      return function() {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
          return accessor.call(this[MEMORY], offset, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], offset, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      };
    } else {
      return function(value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
        return accessor.call(this[MEMORY], offset, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], offset, value, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      }
    }
  } else {
    if (access === 'get') {
      return function(index) {
        try {
          return accessor.call(this[MEMORY], index * byteSize, littleEndian);
        } catch (err) {
          /* WASM-ONLY */
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], index * byteSize, littleEndian);
          } else {
          /* WASM-ONLY-END */
            rethrowRangeError(member, index, err);
          /* WASM-ONLY */
          }
          /* WASM-ONLY-END */
        }
      };
    } else {
      return function(index, value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END */
          return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
          } else {
            rethrowRangeError(member, index, err);
          }
        }
        /* WASM-ONLY-END */
      }
    }
  }
}
