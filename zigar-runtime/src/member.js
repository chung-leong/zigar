import { getBoolAccessor, getNumericAccessor } from './data-view.js';
import {
  EnumExpected, ErrorExpected, NotInErrorSet, NotUndefined, Overflow, adjustRangeError
} from './error.js';
import { restoreMemory } from './memory.js';
import { GETTER, MEMORY, SETTER, SLOTS, VIVIFICATOR } from './symbol.js';
import { MemberType, StructureType, getIntRange } from './types.js';

export function isReadOnly({ type }) {
  switch (type) {
    case MemberType.Type:
    case MemberType.Comptime:
    case MemberType.Literal:
      return true;
    default:
      return false;
  }
}

const factories = {};

export function useVoid() {
  factories[MemberType.Void] = getVoidDescriptor;
}

export function useBool() {
  factories[MemberType.Bool] = getBoolDescriptor;
}

export function useInt() {
  factories[MemberType.Int] = getIntDescriptor;
}

export function useUint() {
  factories[MemberType.Uint] = getUintDescriptor;
}

export function useFloat() {
  factories[MemberType.Float] = getFloatDescriptor;
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

export function useUndefined() {
  factories[MemberType.Undefined] = getUndefinedDescriptor;
}

const transformers = {};

export function useEnumerationTransform() {
  transformers[StructureType.Enumeration] = transformEnumerationDescriptor;
}

export function useErrorSetTransform() {
  transformers[StructureType.ErrorSet] = transformErrorSetDescriptor;
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

export function transformDescriptor(descriptor, member) {
  const { structure } = member;
  const t = transformers[structure?.type];
  return (t) ? t(descriptor, structure) : descriptor;
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
          throw new NotUndefined(member);
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
  }
}

export function getUndefinedDescriptor(member, env) {
  return {
    get: function() {
      return undefined;
    },
  }
}

export function getBoolDescriptor(member, env) {
  return getDescriptorUsing(member, env, getBoolAccessor)
}

export function getIntDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getNumericAccessor);
  const descriptor = getDescriptorUsing(member, env, getDataViewAccessor);
  return transformDescriptor(descriptor, member);
}

export function getUintDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getNumericAccessor);
  const descriptor = getDescriptorUsing(member, env, getDataViewAccessor);
  return transformDescriptor(descriptor, member);
}

function addRuntimeCheck(env, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = env;
    const accessor = getDataViewAccessor(access, member);
    if (runtimeSafety && access === 'set') {
      const { min, max } = getIntRange(member);
      return function(offset, value, littleEndian) {
        if (value < min || value > max) {
          throw new Overflow(member, value);
        }
        accessor.call(this, offset, value, littleEndian);
      };
    }
    return accessor;
  };
}

export function getFloatDescriptor(member, env) {
  return getDescriptorUsing(member, env, getNumericAccessor)
}

export function transformEnumerationDescriptor(int, structure) {  
  const findEnum = function(value) {
    const { constructor } = structure;
    // the enumeration constructor returns the object for the int value
    const item = constructor(value);
    if (!item) {
      throw new EnumExpected(structure, value);
    }
    return item
  };
  return {
    get: (int.get.length === 0) 
    ? function getEnum(hint) {
        const value = int.get.call(this);
        if (hint === 'number') {
          return value;
        }
        return findEnum(value);
      }
    : function getEnumElement(index) {
        const value = int.get.call(this, index);
        return findEnum(value);
      },
    set: (int.set.length === 1) 
    ? function setEnum(value, hint) {
        if (hint !== 'number') {
          const item = findEnum(value);
          // call Symbol.toPrimitive directly as enum can be bigint or number
          value = item[Symbol.toPrimitive]();
        }
        int.set.call(this, value);
      }
    : function setEnumElement(index, value) {
        const item = findEnum(value);
        int.set.call(this, index, item[Symbol.toPrimitive]());
      },
  };
}

export function transformErrorSetDescriptor(int, structure) {
  const findError = function(value) {
    const { constructor } = structure;
    const item = constructor(value);
    if (!item) {
      if (value instanceof Error) {
        throw new NotInErrorSet(structure);
      } else {
        throw new ErrorExpected(structure, value);
      }
    } 
    return item
  };
  return {
    get: (int.get.length === 0) 
    ? function getError(hint) {
        const value = int.get.call(this);
        if (hint === 'number') {
          return value;
        }
        return findError(value);
      }
    : function getErrorElement(index) {
        const value = int.get.call(this, index);
        return findError(value, false);
      },
    set: (int.set.length === 1) 
    ? function setError(value, hint) {
        if (hint !== 'number') {
          const item = findError(value);
          value = Number(item);
        }
        int.set.call(this, value);
      }
    : function setError(index, value) {
        const item = findError(value, false);
        value = Number(item);
        int.set.call(this, index, value);
      },
  };
}

export function isValueExpected(structure) {
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
  return object[GETTER]();
}

function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object;
}

function setValue(slot, value) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  object[SETTER](value);
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
            throw adjustRangeError(member, index, err);
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
            throw adjustRangeError(member, index, err);
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
  useUndefined();
  useBool();
  useInt();
  useUint();
  useFloat();
  useObject();
  useType();
  useComptime();
  useStatic();
  useLiteral();
}
