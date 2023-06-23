import { MemberType, StructureType } from './type.js';
import { SOURCE, SLOTS } from './symbol.js';
import { throwInvalidType } from './error.js';

export function obtainPointerGetter(member, options) {
  if (member.type === MemberType.Object) {
    const { structure, slot } = member;
    if (structure.type === StructureType.Pointer) {
      // get pointer from slot
      return function() { 
        const pointer = this[SOURCE][SLOTS][slot];
        return pointer;
      };
    }
  }
}

export function obtainPointerSetter(member, options) {
  if (member.type === MemberType.Object) {
    const { structure, slot } = member;
    if (structure.type === StructureType.Pointer) {
      // set pointer itself
      return function(v) { 
        const { constructor, copier } = structure;
        if (!(v instanceof constructor)) {
          throwInvalidType(constructor);
        }
        copier(this[SOURCE][SLOTS][slot], v);
      };
    }
  }
}

export function obtainPointerArrayGetter(member, options) {
  if (member.type === MemberType.Object) {
    const { structure } = member;
    if (structure.type === StructureType.Pointer) {
      return function(index) { 
        const pointer = this[SOURCE][SLOTS][index];
        return pointer;
      };
    }
  }
}

export function obtainPointerArraySetter(member, options) {
  if (member.type === MemberType.Object) {
    const { structure } = member;
    if (structure.type === StructureType.Pointer) {
      return function(index, v) { 
        const { constructor, copier } = structure;
        if (!(v instanceof constructor)) {
          throwInvalidType(constructor);
        }
        const object = this[SOURCE][SLOTS][index];
        copier(object, v);
      };
    }
  }
}

export function obtainPointerArrayLengthGetter(member, options) {
  return function() {
    return this[SOURCE].length;
  };
}
