import { MemberType, StructureType, getIntRange } from './type.js';
import { obtainDataViewGetter, obtainDataViewSetter } from './data-view.js';
import { throwNotNull, throwOverflow, throwInvalidEnum, throwEnumExpected } from './error.js';
import { DATA, RELOCATABLE } from './symbol.js';

export function obtainGetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  switch (member.type) {
    case MemberType.Compound:
    case MemberType.Pointer: {
      // get object from slot
      const { slot, structure } = member;
      if (structure.type === StructureType.Singleton) {
        // automatically deferencing pointers to primitives
        return function() { return this[RELOCATABLE][slot].get() };
      } else {
        return function() { return this[RELOCATABLE][slot] };
      }
    } 
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // get value from buffer through DataView
      const { bitOffset } = member;
      const offset = bitOffset >> 3;
      const get = obtainDataViewGetter(member);
      return function() { return get.call(this[DATA], offset, littleEndian) };
    }
    case MemberType.Enum: {
      const { bitOffset, structure } = member;
      const offset = bitOffset >> 3;
      const get = obtainDataViewGetter({ ...member, type: MemberType.Int });
      if (runtimeSafety) {
        return function() {
          const { constructor } = structure;
          const value = get.call(this[DATA], offset, littleEndian);
          // the enumeration constructor returns the singleton object for the value
          const object = constructor(value);
          if (!object) {
            throwInvalidEnum(value)
          }
          return object;
        }; 
      } else {
        return function() {
          const value = get.call(this[DATA], offset, littleEndian);
          return constructor(value);
        }; 
      }
    }
    case MemberType.Void: {
      return function() { return null }; 
    }
  }
}

export function obtainSetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  let fn;
  switch (member.type) {
    case MemberType.Compound: {
      const { slot, structure } = member;
      fn = function(v) {
        const { constructor, copier } = structure;
        if (!(v instanceof constructor)) {
          v = new constructor(v);
        }
        const reloc = this[RELOCATABLE][slot];
        copier(reloc, v);
      };  
    } break;
    case MemberType.Pointer: {
      const { slot, structure, isConst } = member;
      if (isConst) {
        return;
      } 
      if (structure.type === StructureType.Singleton) {
        return function(v) { this[RELOCATABLE][slot].set(v) };
      } else {
        const { constructor } = structure;
        return function(v) {
          if (!(v instanceof constructor)) {
            v = new constructor(v);
          }
          this[RELOCATABLE][slot] = v;
        };
      }
    }
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // change buffer through DataView
      const set = obtainDataViewSetter(member);
      const { type, bitOffset } = member;
      const offset = bitOffset >> 3;
      if (runtimeSafety && type === MemberType.Int) {
        const { isSigned, bitSize } = member;
        const { min, max } = getIntRange(isSigned, bitSize);
        fn = function(v) { 
          if (v < min || v > max) {
            throwOverflow(isSigned, bitSize, v);
          }
          set.call(this[DATA], offset, v, littleEndian);
        };
      } else {
        fn = function(v) { set.call(this[DATA], offset, v, littleEndian) };
      }
    } break;
    case MemberType.Void: {
      if (runtimeSafety) {
        fn = function(v) { 
          if (v != null) {
            throwNotNull();
          }
        };
      } else {
        fn = function() {};
      }
    } break;
    case MemberType.Enum: {
      const { bitOffset, structure } = member;
      const offset = bitOffset >> 3;
      const set = obtainDataViewSetter({ ...member, type: MemberType.Int });
      return function(v) {
        const { constructor } = structure;
        if (!(v instanceof constructor)) {
          throwEnumExpected(constructor);
        }
        set.call(this[DATA], offset, v.valueOf(), littleEndian);
      }; 
    }
  }
  return fn;
}
