import { MemberType, StructureType, getIntRange } from './type.js';
import { obtainDataViewGetter, obtainDataViewSetter } from './data-view.js';
import { throwNotNull, throwOverflow, throwInvalidEnum, throwEnumExpected } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';

export function obtainGetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  let fn;
  switch (member.type) {
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // get value from buffer through DataView
      const { bitOffset } = member;
      const offset = bitOffset >> 3;
      const get = obtainDataViewGetter(member);
      fn = function() { 
        return get.call(this[MEMORY], offset, littleEndian);
      };
    } break;
    case MemberType.Void: {
      fn = function() { 
        return null;
      }; 
    } break;
    case MemberType.EnumerationItem: {
      const { bitOffset, structure } = member;
      const offset = bitOffset >> 3;
      const get = obtainDataViewGetter({ ...member, type: MemberType.Int });
      if (runtimeSafety) {
        fn = function() {
          const { constructor } = structure;
          const value = get.call(this[MEMORY], offset, littleEndian);
          // the enumeration constructor returns the singleton object for the value
          const object = constructor(value);
          if (!object) {
            throwInvalidEnum(value)
          }
          return object;
        }; 
      } else {
        fn = function() {
          const value = get.call(this[MEMORY], offset, littleEndian);
          return constructor(value);
        }; 
      }
    } break;
    case MemberType.Object: {
      // automatically dereference pointer
      const { structure } = member;
      if (structure.type === StructureType.Pointer) {
        const { members: [ target ] } = structure;
        if (target.type === StructureType.Singleton) {
          fn = function() { 
            const pointer = this[SLOTS][slot];
            const target = pointer['*'];
            return target.get() 
          };  
        } else {
          fn = function() { 
            const pointer = this[SLOTS][slot]['*'];
            const target = pointer['*'];
            return target;
          };  
        }
      } else {
        fn = function() { 
          const object = this[SLOTS][slot];
          return object;
        }; 
      }
    } break;
  }
  return fn;
}

export function obtainSetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  let fn;
  switch (member.type) {
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
          set.call(this[MEMORY], offset, v, littleEndian);
        };
      } else {
        fn = function(v) { 
          set.call(this[MEMORY], offset, v, littleEndian);
        };
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
    case MemberType.EnumerationItem: {
      const { bitOffset, structure } = member;
      const offset = bitOffset >> 3;
      const set = obtainDataViewSetter({ ...member, type: MemberType.Int });
      fn = function(v) {
        const { constructor } = structure;
        if (!(v instanceof constructor)) {
          throwEnumExpected(constructor);
        }
        set.call(this[MEMORY], offset, v.valueOf(), littleEndian);
      }; 
    }
    case MemberType.Object: {
      const { slot, structure, isConst } = member;
      if (structure.type === StructureType.Pointer) {
        if (member.isConst) {
          break;
        }
        const { members: [ target ] } = structure;
        if (target.type === StructureType.Singleton) {
          fn = function(v) { 
            const pointer = this[SLOTS][slot];
            const target = pointer['*'];
            target.set(v); 
          };
        } else {
          fn = function(v) { 
            const pointer = this[SLOTS][slot]['*'];
            pointer['*'] = v;
          };
        }
      } else {
        fn = function(v) {
          const { constructor, copier } = structure;
          if (!(v instanceof constructor)) {
            v = new constructor(v);
          }
          const object = this[SLOTS][slot];
          copier(object, v);
        };  
      }
    } break;
  }
  return fn;
}

