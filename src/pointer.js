import { MemberType, StructureType } from './type.js';
import { SOURCE, SLOTS } from './symbol.js';
import { throwInvalidType } from './error.js';

export function obtainPointerGetter(member, options) {
  let fn;
  if (member.type === MemberType.Object) {
    const { structure, slot } = member;
    if (structure.type === StructureType.Pointer) {
      // get pointer from slot
      fn = function() { 
        const pointer = this[SOURCE][SLOTS][slot];
        return pointer;
      };
    }
  }
  return fn;
}

export function obtainPointerSetter(member, options) {
  let fn;
  if (member.type === MemberType.Object) {
    const { structure, slot } = member;
    if (structure.type === StructureType.Pointer) {
      // set pointer itself
      fn = function(v) { 
        const { constructor, copier } = structure;
        if (!(v instanceof constructor)) {
          throwInvalidType(constructor);
        }
        copier(this[SOURCE][SLOTS][slot], v);
      };
    }
  }
  return fn;
}

export function obtainPointerArrayGetter(member, options) {
  let fn;
  if (member.type === MemberType.Object) {
    const { structure } = member;
    if (structure.type === StructureType.Pointer) {
      fn = function(index) { 
        const pointer = this[SOURCE][SLOTS][index];
        return pointer;
      };
    }
  }
  return fn;
}

export function obtainPointerArraySetter(member, options) {
  let fn;
  if (member.type === MemberType.Object) {
    const { structure } = member;
    if (structure.type === StructureType.Pointer) {
      fn = function(index, v) { 
        const { constructor, copier } = structure;
        if (!(v instanceof constructor)) {
          throwInvalidType(constructor);
        }
        const object = this[SOURCE][SLOTS][index];
        copier(object, v);
      };
    }
  }
  return fn;
}

export function obtainPointerArrayLengthGetter(member, options) {
  let fn = function() {
    return this[SOURCE].length;
  };
  return fn;
}