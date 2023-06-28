import { MemberType, StructureType, getIntRange } from './type.js';
import { obtainDataViewGetter, obtainDataViewSetter } from './data-view.js';
import { throwNotNull, throwOverflow, throwInvalidEnum, throwEnumExpected } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';

export function obtainGetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
    autoDeref = true,
  } = options;
  switch (member.type) {
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // get value from buffer through DataView
      const { bitOffset } = member;
      const offset = bitOffset >> 3;
      const get = obtainDataViewGetter(member);
      return function() {
        return get.call(this[MEMORY], offset, littleEndian);
      };
    }
    case MemberType.Void: {
      return function() {
        return null;
      };
    }
    case MemberType.EnumerationItem: {
      const { bitOffset, structure } = member;
      const offset = bitOffset >> 3;
      const get = obtainDataViewGetter({ ...member, type: MemberType.Int });
      if (runtimeSafety) {
        return function() {
          const { constructor } = structure;
          const value = get.call(this[MEMORY], offset, littleEndian);
          // the enumeration constructor returns the primitive object for the value
          const object = constructor(value);
          if (!object) {
            throwInvalidEnum(value)
          }
          return object;
        };
      } else {
        return function() {
          const value = get.call(this[MEMORY], offset, littleEndian);
          return constructor(value);
        };
      }
    }
    case MemberType.Object: {
      // automatically dereference pointer
      const { structure, slot } = member;
      switch (structure.type) {
        case StructureType.ErrorUnion:
        case StructureType.Optional: {
          return function() {
            const object = this[SLOTS][slot];
            return object.get();
          };
        }
        case StructureType.Pointer: {
          if (autoDeref) {
            const { instance: { members: [ target ] } } = structure;
            if (target.structure.type === StructureType.Primitive) {
              return function() {
                const pointer = this[SLOTS][slot];
                const object = pointer['*'];
                return object.get()
              };
            } else {
              return function() {
                const pointer = this[SLOTS][slot];
                const object = pointer['*'];
                return object;
              };
            }
          }
        }
        default:
          return function() {
            const object = this[SLOTS][slot];
            return object;
          };
      }
    }
    case MemberType.Type: {
      const { structure } = member;
      return function() {
        const { constructor } = structure;
        return constructor;
      };
    }
  }
}

export function obtainSetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
    autoDeref = true,
  } = options;
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
        return function(v) {
          if (v < min || v > max) {
            throwOverflow(isSigned, bitSize, v);
          }
          set.call(this[MEMORY], offset, v, littleEndian);
        };
      } else {
        return function(v) {
          set.call(this[MEMORY], offset, v, littleEndian);
        };
      }
    } break;
    case MemberType.Void: {
      if (runtimeSafety) {
        return function(v) {
          if (v != null) {
            throwNotNull();
          }
        };
      } else {
        return function() {};
      }
    }
    case MemberType.EnumerationItem: {
      const { bitOffset, structure } = member;
      const offset = bitOffset >> 3;
      const set = obtainDataViewSetter({ ...member, type: MemberType.Int });
      return function(v) {
        const { constructor } = structure;
        if (!(v instanceof constructor)) {
          throwEnumExpected(constructor);
        }
        set.call(this[MEMORY], offset, v.valueOf(), littleEndian);
      };
    }
    case MemberType.Object: {
      const { slot, structure, isConst } = member;
      if (isConst) {
        return;
      }
      switch (structure.type) {
        case StructureType.ErrorUnion:
        case StructureType.Optional: {
          return function(v) {
            const object = this[SLOTS][slot];
            return object.set(v);
          };
        }
        case StructureType.Pointer: {
          if (autoDeref) {
            const { instance: { members: [ target ] } } = structure;
            if (target.structure.type === StructureType.Primitive) {
              return function(v) {
                const pointer = this[SLOTS][slot];
                const object = pointer['*'];
                object.set(v);
              };
            } else {
              return function(v) {
                const pointer = this[SLOTS][slot];
                pointer['*'] = v;
              };
            }
          }
        }
        default: {
          return function(v) {
            const { constructor, copier } = structure;
            if (!(v instanceof constructor)) {
              v = new constructor(v);
            }
            const object = this[SLOTS][slot];
            copier(object, v);
          };
        }
      }
    }
    case MemberType.Type: {
      // not setter for types
      return;
    }
  }
}
