import { StructureType } from './structure.js';
import {
  getDataViewBoolAccessor,
  getDataViewBoolAccessorEx,
  getDataViewIntAccessor,
  getDataViewIntAccessorEx,
  getDataViewFloatAccessor,
  getDataViewFloatAccessorEx,
} from './data-view.js';
import { MEMORY, SLOTS } from './symbol.js';

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

export function useType() {
  factories[MemberType.Type] = getTypeAccessor;
}

export function getAccessors(member, options = {}) {
  const f = factories[member.type];
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
          throwNotNull();
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
  return getAccessorUsing(access, member, options, getDataViewIntAccessor)
}

export function getIntAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewIntAccessorEx)
}

export function getFloatAccessor(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewFloatAccessor)
}

export function getFloatAccessorEx(access, member, options) {
  return getBoolAccessorUsing(access, member, options, getDataViewFloatAccessorEx)
}

export function getEnumerationItemAccessor(access, member, options) {
  return getEnumerationItemAccessorUsing(access, member, options, getDataViewIntAccessor) ;
}

export function getEnumerationItemAccessorEx(access, member, options) {
  return getEnumerationItemAccessorUsing(access, member, options, getDataViewIntAccessorEx) ;
}

export function getObjectAccessor(access, member, options) {
  // automatically dereference pointer
  const {
    autoDeref = true,
  } = options;
  const { structure, slot, bitOffset } = member;
  switch (structure.type) {
    case StructureType.ErrorUnion:
    case StructureType.Optional: {
      if (bitOffset !== undefined) {
        if (access === 'get') {
          return function() {
            const object = this[SLOTS][slot];
            return object.get();
          };
        } else {
          return function(value) {
            const object = this[SLOTS][slot];
            return object.set(value);
          };
        }
      } else {
        if (access === 'get') {
          return function(index) {
            const object = this[SLOTS][index];
            return object.get();
          };
        } else {
          return function(index, value) {
            const object = this[SLOTS][index];
            return object.set(value);
          };
        }
      }
    }
    case StructureType.Pointer: {
      if (autoDeref) {
        const { isConst, instance: { members: [ target ] } } = structure;
        if (target.structure.type === StructureType.Primitive) {
          if (bitOffset !== undefined) {
            if (access === 'get') {
              return function() {
                const pointer = this[SLOTS][slot];
                const object = pointer['*'];
                return object.get()
              };
            } else {
              return function(value) {
                const pointer = this[SLOTS][slot];
                const object = pointer['*'];
                object.set(value);
              };
            }
          } else {
            if (access === 'get') {
              return function(index) {
                const pointer = this[SLOTS][index];
                const object = pointer['*'];
                return object.get()
              };
            } else {
              return function(index, value) {
                const pointer = this[SLOTS][index];
                const object = pointer['*'];
                object.set(value);
              };
            }
          }
        } else {
          if (bitOffset !== undefined) {
            if (access === 'get') {
              return function() {
                const pointer = this[SLOTS][slot];
                const object = pointer['*'];
                return object;
              };
            } else {
              return function(value) {
                const pointer = this[SLOTS][slot];
                pointer['*'] = value;
              };
            }
          }
        }
      }
    }
    default: {
      if (bitOffset !== undefined) {
        if (access === 'get') {
          return function() {
            const object = this[SLOTS][slot];
            return object;
          };
        } else {
          return function(value) {
            const { constructor, copier } = structure;
            if (!(value instanceof constructor)) {
              value = new constructor(value);
            }
            const object = this[SLOTS][slot];
            copier(object, value);
          };
        }
      } else {
        if (access === 'get') {
          return function(index) {
            const object = this[SLOTS][index];
            return object;
          };
        } else {
          return function(index, value) {
            const { constructor, copier } = structure;
            if (!(value instanceof constructor)) {
              value = new constructor(value);
            }
            const object = this[SLOTS][index];
            copier(object, value);
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
    if (access === 'get') {
      return function() {
        return accessor.call(this[MEMORY], offset, littleEndian);
      };
    } else {
      return function(value) {
        return accessor.call(this[MEMORY], offset, value, littleEndian);
      }
    }
  } else {
    if (access === 'get') {
      return function(index) {
        return accessor.call(this[MEMORY], index * byteSize, littleEndian);
      };
    } else {
      return function(index, value) {
        return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
      }
    }
  }
}

function getEnumerationItemAccessorUsing(access, member, options, getDataViewIntAccessor) {
  const { runtimeSafety, littleEndian } = options;
  const { bitOffset, structure } = member;
  const accessor = getDataViewIntAccessor(access, { ...member, type: MemberType.Int });
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    if (access === 'get') {
      if (runtimeSafety) {
        return function() {
          const { constructor } = structure;
          const value = accessor.call(this[MEMORY], offset, littleEndian);
          // the enumeration constructor returns the primitive object for the value
          const object = constructor(value);
          if (!object) {
            throwInvalidEnum(value)
          }
          return object;
        };
      } else {
        return function() {
          const { constructor } = structure;
          const value = accessor.call(this[MEMORY], offset, littleEndian);
          return constructor(value);
        };
      }
    } else {
      return function(value) {
        const { constructor } = structure;
        if (!(value instanceof constructor)) {
          throwEnumExpected(constructor);
        }
        accessor.call(this[MEMORY], offset, value.valueOf(), littleEndian);
      };
    }
  } else {
    if (access === 'get') {
      if (runtimeSafety) {
        return function(index) {
          const { constructor } = structure;
          const value = accessor.call(this[MEMORY], index * byteSize, littleEndian);
          // the enumeration constructor returns the primitive object for the value
          const object = constructor(value);
          if (!object) {
            throwInvalidEnum(value)
          }
          return object;
        };
      } else {
        return function(index) {
          const value = accessor.call(this[MEMORY], index * byteSize, littleEndian);
          return constructor(value);
        };
      }
    } else {
      return function(index, value) {
        const { constructor } = structure;
        if (!(value instanceof constructor)) {
          throwEnumExpected(constructor);
        }
        accessor.call(this[MEMORY], index * byteSize, value.valueOf(), littleEndian);
      };
    }
  }
}
