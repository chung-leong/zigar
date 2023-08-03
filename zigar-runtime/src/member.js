import { StructureType } from './structure.js';
import {
  getDataViewBoolAccessor,
  getDataViewBoolAccessorEx,
  getDataViewIntAccessor,
  getDataViewIntAccessorEx,
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
import { MEMORY, SLOTS, SOURCE } from './symbol.js';

export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Float: 3,
  EnumerationItem: 4,
  Object: 5,
  Type: 6,
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

export function getMemberFeature(member) {
  const { type, bitSize } = member;
  switch (type) {
    case MemberType.Int:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
        return 'useInt';
      } else {
        return 'useIntEx';
      }
    case MemberType.EnumerationItem:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
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

export function useType() {
  factories[MemberType.Type] = getTypeAccessor;
}

export function getAccessors(member, options = {}) {
  const f = factories[member.type];
  if (process.env.NODE_ENV !== 'production') {
    /* c8 ignore next 10 */
    if (typeof(f) !== 'function') {
      const [ name ] = Object.entries(MemberType).find(a => a[1] === member.type);
      throw new Error(`No factory for ${name}: ${member.name}`);
    }
  }
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

function addRuntimeCheck(options, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = options;
    const accessor = getDataViewAccessor(access, member);
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
    const accessor = getDataViewIntAccessor(access, { ...member, type: MemberType.Int });
    const { structure } = member;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const { constructor } = structure;
        const value = accessor.call(this, offset, littleEndian);
        // the enumeration constructor returns the object for the int value
        const object = constructor(value);
        if (!object) {
          throwInvalidEnum(value)
        }
        return object;
      };
    } else {
      return function(offset, value, littleEndian) {
        const { constructor } = structure;
        if (!(value instanceof constructor)) {
          throwEnumExpected(constructor);
        }
        accessor.call(this, offset, value.valueOf(), littleEndian);
      };
    }
  };
}

export function getObjectAccessor(access, member, options) {
  const { structure, slot } = member;
  switch (structure.type) {
    case StructureType.ErrorUnion:
    case StructureType.Optional: {
      if (slot !== undefined) {
        if (access === 'get') {
          return function() {
            const object = this[SLOTS][slot];
            return object.$;
          };
        } else {
          return function(value) {
            const object = this[SLOTS][slot];
            return object.$ = value;
          };
        }
      } else {
        if (access === 'get') {
          return function(index) {
            const object = this[SLOTS][index];
            return object.$;
          };
        } else {
          return function(index, value) {
            const object = this[SLOTS][index];
            return object.$ = value;
          };
        }
      }
    }
    default: {
      if (slot !== undefined) {
        if (access === 'get') {
          return function() {
            const object = this[SLOTS][slot];
            return object;
          };
        } else {
          return function(value) {
            const object = this[SLOTS][slot];
            object.$ = value;
          };
        }
      } else {
        // array accessors
        if (access === 'get') {
          return function(index) {
            const object = this[SLOTS][index];
            return object;
          };
        } else {
          return function(index, value) {
            const object = this[SLOTS][index];
            object.$ = value;
          };
        }
      }
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
    runtimeSafety = true,
    littleEndian = true,
  } = options;
  const { type, bitOffset, byteSize } = member;
  const accessor = getDataViewAccessor(access, member);
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
      if (access === 'get') {
        return function() {
          try {
            return accessor.call(this[MEMORY], offset, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], offset, littleEndian);
            } else {
              throw err;
            }
          }
        };
      } else {
        return function(value) {
          try {
            return accessor.call(this[MEMORY], offset, value, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], offset, value, littleEndian);
            } else {
              throw err;
            }
          }
        }
      }
    } else {
      if (access === 'get') {
        return function() {
          return accessor.call(this[MEMORY], offset, littleEndian);
        };
      } else {
        return function(value) {
          return accessor.call(this[MEMORY], offset, value, littleEndian);
        }
      }
    }
  } else {
    if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
      if (access === 'get') {
        return function(index) {
          try {
            return accessor.call(this[MEMORY], index * byteSize, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], index * byteSize, littleEndian);
            } else {
              rethrowRangeError(member, index, err);
            }
          }
        };
      } else {
        return function(index, value) {
          try {
            return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
            } else {
              rethrowRangeError(member, index, err);
            }
          }
        }
      }
    } else {
      if (access === 'get') {
        return function(index) {
          try {
            return accessor.call(this[MEMORY], index * byteSize, littleEndian);
          } catch (err) {
            rethrowRangeError(member, index, err);
          }
        };
      } else {
        return function(index, value) {
          try {
            return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
          } catch (err) {
            rethrowRangeError(member, index, err);
          }
        }
      }
    }
  }
}

export function restoreMemory() {
  const dv = this[MEMORY];
  const source = dv[SOURCE];
  if (!source || dv.byteOffset !== 0) {
    return false;
  }
  const { memory, address, len } = source;
  const newDV = new DataView(memory.buffer, address, len);
  newDV[SOURCE] = source;
  Object.defineProperty(this, MEMORY, { value: newDV, configurable: true });
  return true;
}
