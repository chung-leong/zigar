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
import { MEMORY, CHILD_VIVIFICATOR, SLOTS } from './symbol.js';

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
  Static: 9,
  Literal: 10,
};

export function isReadOnly(type) {
  switch (type) {
    case MemberType.Type:
    case MemberType.Comptime:
    case MemberType.Literal:
      return true;
    default:
      return false;
  }
}

const factories = Array(Object.values(MemberType).length);

export function useVoid() {
  factories[MemberType.Void] = getVoidDescriptor;
}

export function useBool() {
  factories[MemberType.Bool] = getBoolDescriptor;
}

export function useBoolEx() {
  factories[MemberType.Bool] = getBoolDescriptorEx;
}

export function useInt() {
  factories[MemberType.Int] = getIntDescriptor;
}

export function useIntEx() {
  factories[MemberType.Int] = getIntDescriptorEx;
}

export function useUint() {
  factories[MemberType.Uint] = getUintDescriptor;
}

export function useUintEx() {
  factories[MemberType.Uint] = getUintDescriptorEx;
}

export function useFloat() {
  factories[MemberType.Float] = getFloatDescriptor;
}

export function useFloatEx() {
  factories[MemberType.Float] = getFloatDescriptorEx;
}

export function useEnumerationItem() {
  factories[MemberType.EnumerationItem] = getEnumerationItemDescriptor;
}

export function useEnumerationItemEx() {
  factories[MemberType.EnumerationItem] = getEnumerationItemDescriptorEx;
}

export function useObject() {
  factories[MemberType.Object] = getObjectDescriptor;
}

export function useType() {
  factories[MemberType.Type] = getTypeDescriptor;
}

export function useComptime() {
  factories[MemberType.Comptime] = getComptimeDescriptor;
}

export function useStatic() {
  factories[MemberType.Static] = getStaticDescriptor;
}

export function useLiteral() {
  factories[MemberType.Literal] = getLiteralDescriptor;
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
    case MemberType.Comptime:
      return 'useComptime';
    case MemberType.Comptime:
      return 'useStatic';
    case MemberType.Literal:
      return 'useLiteral';
  }
}

export function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

export function getDescriptor(member, env) {
  const f = factories[member.type];
  /* DEV-TEST */
  /* c8 ignore next 4 */
  if (typeof(f) !== 'function') {
    const [ name ] = Object.entries(MemberType).find(a => a[1] === member.type);
    throw new Error(`No factory for ${name}: ${member.name}`);
  }
  /* DEV-TEST-END */
  return { ...f(member, env), configurable: true, enumerable: true };
}

export function getVoidDescriptor(member, env) {
  const { runtimeSafety } = env;
  return {
    get: function() {
      return null;
    },
    set: (runtimeSafety)
    ? function(value) {
        if (value != null) {
          throwNotNull(member);
        }
      }
    : function() {},
  }
}

export function getBoolDescriptor(member, env) {
  return getDescriptorUsing(member, env, getDataViewBoolAccessor)
}

export function getBoolDescriptorEx(member, env) {
  return getDescriptorUsing(member, env, getDataViewBoolAccessorEx)
}

export function getIntDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getDataViewIntAccessor);
  return getDescriptorUsing(member, env, getDataViewAccessor)
}

export function getIntDescriptorEx(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getDataViewIntAccessorEx);
  return getDescriptorUsing(member, env, getDataViewAccessor)
}

export function getUintDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getDataViewUintAccessor);
  return getDescriptorUsing(member, env, getDataViewAccessor)
}

export function getUintDescriptorEx(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getDataViewUintAccessorEx);
  return getDescriptorUsing(member, env, getDataViewAccessor)
}

function addRuntimeCheck(env, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = env;
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

export function getFloatDescriptor(member, env) {
  return getDescriptorUsing(member, env, getDataViewFloatAccessor)
}

export function getFloatDescriptorEx(member, env) {
  return getDescriptorUsing(member, env, getDataViewFloatAccessorEx)
}

export function getEnumerationItemDescriptor(member, env) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessor);
  return getDescriptorUsing(member, env, getDataViewAccessor) ;
}

export function getEnumerationItemDescriptorEx(member, env) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessorEx);
  return getDescriptorUsing(member, env, getDataViewAccessor) ;
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

function isValueExpected(structure) {
  switch (structure.type) {
    case StructureType.Primitive:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
      return true;
    default:
      return false;
  }
}

export function getObjectDescriptor(member, env) {
  const { structure, slot } = member;
  if (slot !== undefined) {
    return {
      get: (isValueExpected(structure))
      ? function getValue() {
        const object = this[CHILD_VIVIFICATOR][slot].call(this);
        return object.$;
      }
      : function getObject() {
        const object = this[CHILD_VIVIFICATOR][slot].call(this);
        return object;
      },
      set: function setValue(value) {
        const object = this[CHILD_VIVIFICATOR][slot].call(this);
        object.$ = value;
      },
    };
  } else {
    // array accessors
    return {
      get: (isValueExpected(structure))
      ? function getValue(index) {
        const object = this[CHILD_VIVIFICATOR](index);
        return object.$;
      }
      : function getObject(index) {
        const object = this[CHILD_VIVIFICATOR](index);
        return object;
      },
      set: function setValue(index, value) {
        const object = this[CHILD_VIVIFICATOR](index);
        object.$ = value;
      },
    };
  }
}

export function getTypeDescriptor(member, env) {
  const { slot } = member;
  return {
    get: function getType() {
      // unsupported types will have undefined structure
      const structure = this[SLOTS][slot];
      return structure?.constructor;
    },
    // no setter
  };
}

export function getComptimeDescriptor(member, env) {
  const { slot, structure } = member;
  return {
    get: (isValueExpected(structure))
    ? function getValue() {
      const object = this[SLOTS][slot];
      return object.$;
    }
    : function getObject() {
      const object = this[SLOTS][slot];
      return object;
    },
  };
}

export function getStaticDescriptor(member, env) {
  const { slot, structure } = member;
  if (structure.type === StructureType.Enumeration) {
    // enum needs to be dealt with separately, since the object reference changes
    const { 
      instance: { members: [ member ] },
    } = structure;
    const enumMember = { ...member, structure, type: MemberType.EnumerationItem };
    const { get, set } = getDescriptor(enumMember, env);
    return {
      get: function getEnum() {
        const object = this[SLOTS][slot];
        return get.call(object);
      },
      set: function setEnum(arg) {
        const object = this[SLOTS][slot];
        return set.call(object, arg);
      },
    };
  } else {
    return {
      ...getComptimeDescriptor(member, env),
      set: function setValue(value) {
        const object = this[SLOTS][slot];
        object.$ = value;
      },
    };  
  }
}

export function getLiteralDescriptor(member, env) {
  const { slot } = member;
  return {
    get: function getType() {
      const object = this[SLOTS][slot];
      return object.string;
    },
    // no setter
  };
}

function getDescriptorUsing(member, env, getDataViewAccessor) {
  const {
    littleEndian = true,
  } = env;
  const { bitOffset, byteSize } = member;
  const getter = getDataViewAccessor('get', member);
  const setter = getDataViewAccessor('set', member);
  /* DEV-TEST */
  /* c8 ignore next 3 */
  if (!getter || !setter) {
    return;
  }
  /* DEV-TEST-END */
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    return {
      get: function getValue() {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
          return getter.call(this[MEMORY], offset, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return getter.call(this[MEMORY], offset, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      },
      set: function setValue(value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
        return setter.call(this[MEMORY], offset, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return setter.call(this[MEMORY], offset, value, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      }
    }
  } else {
    return {
      get: function getElement(index) {
        try {
          return getter.call(this[MEMORY], index * byteSize, littleEndian);
        } catch (err) {
          /* WASM-ONLY */
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return getter.call(this[MEMORY], index * byteSize, littleEndian);
          } else {
          /* WASM-ONLY-END */
            rethrowRangeError(member, index, err);
          /* WASM-ONLY */
          }
          /* WASM-ONLY-END */
        }
      },
      set: function setElement(index, value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END */
          return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
          } else {
            rethrowRangeError(member, index, err);
          }
        }
        /* WASM-ONLY-END */
      },
    }
  }
}

export function useAllMemberTypes() {
  useVoid();
  useBoolEx();
  useIntEx();
  useUintEx();
  useFloatEx();
  useEnumerationItemEx();
  useObject();
  useType();
  useComptime();
  useStatic();
  useLiteral();
}
