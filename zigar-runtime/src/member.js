import {
  getDataViewBoolAccessor,
  getDataViewBoolAccessorEx,
  getDataViewFloatAccessor,
  getDataViewFloatAccessorEx,
  getDataViewIntAccessor,
  getDataViewIntAccessorEx,
  getDataViewUintAccessor,
  getDataViewUintAccessorEx,
} from './data-view.js';
import { getGlobalErrorSet } from './error-set.js';
import {
  rethrowRangeError,
  throwEnumExpected,
  throwErrorExpected,
  throwNotInErrorSet,
  throwNotNull,
  throwNotUndefined,
  throwOverflow,
} from './error.js';
import { restoreMemory } from './memory.js';
import { getIntRange } from './primitive.js';
import { StructureType } from './structure.js';
import { MEMORY, SLOTS, VIVIFICATOR } from './symbol.js';

export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  EnumerationItem: 5,
  Error: 6,
  Object: 7,
  Type: 8,
  Comptime: 9,
  Static: 10,
  Literal: 11,
  Null: 12,
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

export function useError() {
  factories[MemberType.Error] = getErrorDescriptor;
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

export function useNull() {
  factories[MemberType.Null] = getNullDescriptor;
}

export function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

export function hasStandardIntSize({ bitSize }) {
  return bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64;
}

export function hasStandardFloatSize({ bitSize }) {
  return bitSize === 32 || bitSize === 64;
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
  return f(member, env);
}

export function getVoidDescriptor(member, env) {
  const { runtimeSafety } = env;
  return {
    get: function() {
      return undefined;
    },
    set: (runtimeSafety)
    ? function(value) {
        if (value !== undefined) {
          throwNotUndefined(member);
        }
      }
    : function() {},
  }
}

export function getNullDescriptor(member, env) {
  const { runtimeSafety } = env;
  return {
    get: function() {
      return null;
    },
    set: (runtimeSafety)
    ? function(value) {
        if (value !== null) {
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
  const { structure } = member;
  // enum can be int or uint--need the type from the structure
  const { type: intType, structure: intStructure } = structure.instance.members[0];
  const valueMember = {
    ...member,
    type: intType,
    structure: intStructure,
  };
  const { get: getValue, set: setValue } = getDescriptor(valueMember, env);
  const findEnum = function(value) {
    const { constructor } = structure;
    // the enumeration constructor returns the object for the int value
    const item = (value instanceof constructor) ? value : constructor(value);
    if (!item) {
      throwEnumExpected(structure, value);
    }
    return item
  };
  return {
    get: (getValue.length === 0) 
    ? function getEnum() {
        const value = getValue.call(this);
        return findEnum(value);
      }
    : function getEnumElement(index) {
        const value = getValue.call(this, index);
        return findEnum(value);
      },
    set: (setValue.length === 1) 
    ? function setEnum(value) {
        // call Symbol.toPrimitive directly as enum can be bigint or number
        const item = findEnum(value);
        setValue.call(this, item[Symbol.toPrimitive]());
      }
    : function setEnumElement(index, value) {
        const item = findEnum(value);
        setValue.call(this, index, item[Symbol.toPrimitive]());
      },
  };
}

export function getErrorDescriptor(member, env) {
  const { structure } = member;
  const { name, instance: { members } } = structure;
  const { type: intType, structure: intStructure } = members[0];
  const valueMember = {
    ...member,
    type: intType,
    structure: intStructure,
  };
  const { get: getValue, set: setValue } = getDescriptor(valueMember, env);  
  const acceptAny = name === 'anyerror';
  const globalErrorSet = getGlobalErrorSet();
  const findError = function(value, allowZero = false) {
    const { constructor } = structure;
    // the enumeration constructor returns the object for the int value
    let item;
    if (value === 0 && allowZero) {
      return;
    } else if (value instanceof Error) {
      if (value instanceof (acceptAny ? globalErrorSet : constructor)) {
        item = value;
      } else {
        throwNotInErrorSet(structure);
      }
    } else {
      item = acceptAny ? globalErrorSet[value] : constructor(value);
      if (!item) {
        throwErrorExpected(structure, value);
      } 
    }
    return item
  };
  return {
    get: (getValue.length === 0) 
    ? function getError(allowZero) {
        const value = getValue.call(this);
        return findError(value, allowZero);
      }
    : function getErrorElement(index) {
        const value = getValue.call(this, index);
        return findError(value, false);
      },
    set: (setValue.length === 1) 
    ? function setError(value, allowZero) {
        const item = findError(value, allowZero);
        setValue.call(this, Number(item ?? 0));
      }
    : function setError(index, value) {
        const item = findError(value, false);
        setValue.call(this, index, Number(item));
      },
  };
}

function isValueExpected(structure) {
  switch (structure.type) {
    case StructureType.Primitive:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
    case StructureType.Enumeration:
    case StructureType.ErrorSet:
      return true;
    default:
      return false;
  }
}

function getValue(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object.$;
}

function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object;
}

function setValue(slot, value) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  object.$ = value;
}

function bindSlot(slot, { get, set }) {
  if (slot !== undefined) {
    return { 
      get: function() {
        return get.call(this, slot);
      },
      set: (set) 
      ? function(arg) {
          return set.call(this, slot, arg);
        } 
      : undefined,
    };
  } else {
    // array accessors
    return { get, set };
  }
}

export function getObjectDescriptor(member, env) {
  const { structure, slot } = member;
  return bindSlot(slot, {
    get: isValueExpected(structure) ? getValue : getObject,
    set: setValue,
  });
}

function getType(slot) {
  // unsupported types will have undefined structure
  const structure = this[SLOTS][slot];
  return structure?.constructor;
}

export function getTypeDescriptor(member, env) {
  const { slot } = member;
  return bindSlot(slot, { get: getType });
}

export function getComptimeDescriptor(member, env) {
  const { slot, structure } = member;
  return bindSlot(slot, {
    get: isValueExpected(structure) ? getValue : getObject,
  });
}

export function getStaticDescriptor(member, env) {
  const { slot, structure } = member;
  return bindSlot(slot, {
    get: isValueExpected(structure) ? getValue : getObject,
    set: setValue,
  });
}

function getLiteral(slot) {
  const object = this[SLOTS][slot];
  return object.string;
}

export function getLiteralDescriptor(member, env) {
  const { slot } = member;
  return bindSlot(slot, { get: getLiteral });
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
  useNull();
  useBoolEx();
  useIntEx();
  useUintEx();
  useFloatEx();
  useEnumerationItem();
  useError();
  useObject();
  useType();
  useComptime();
  useStatic();
  useLiteral();
}
