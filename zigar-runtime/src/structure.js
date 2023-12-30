import { definePrimitive } from './primitive.js';
import { defineArray } from './array.js';
import { defineStructShape } from './struct.js';
import { defineUnionShape } from './union.js';
import { defineErrorUnion } from './error-union.js'
import { defineErrorSet } from './error-set.js';
import { defineEnumerationShape } from './enumeration.js';
import { defineOptional } from './optional.js';
import { definePointer } from './pointer.js';
import { defineSlice } from './slice.js';
import { defineVector } from './vector.js';
import { defineArgStruct } from './arg-struct.js';
import { throwReadOnly } from './error.js';
import { MemberType } from './member.js';

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ArgStruct: 3,
  ExternUnion: 4,
  BareUnion: 5,
  TaggedUnion: 6,
  ErrorUnion: 7,
  ErrorSet: 8,
  Enumeration: 9,
  Optional: 10,
  Pointer: 11,
  Slice: 12,
  Vector: 13,
  Opaque: 14,
  Function: 15,
};

const factories = Array(Object.values(StructureType).length);

export function usePrimitive() {
  factories[StructureType.Primitive] = definePrimitive;
}

export function useArray() {
  factories[StructureType.Array] = defineArray;
}

export function useStruct() {
  factories[StructureType.Struct] = defineStructShape;
}

export function useExternUnion() {
  factories[StructureType.ExternUnion] = defineUnionShape;
}

export function useBareUnion() {
  factories[StructureType.BareUnion] = defineUnionShape;
}

export function useTaggedUnion() {
  factories[StructureType.TaggedUnion] = defineUnionShape;
}

export function useErrorUnion() {
  factories[StructureType.ErrorUnion] = defineErrorUnion;
}

export function useErrorSet() {
  factories[StructureType.ErrorSet] = defineErrorSet;
}

export function useEnumeration() {
  factories[StructureType.Enumeration] = defineEnumerationShape;
}

export function useOptional() {
  factories[StructureType.Optional] = defineOptional;
}

export function usePointer() {
  factories[StructureType.Pointer] = definePointer;
}

export function useSlice() {
  factories[StructureType.Slice] = defineSlice;
}

export function useVector() {
  factories[StructureType.Vector] = defineVector;
}

export function useOpaque() {
  factories[StructureType.Opaque] = defineStructShape;
}

export function useArgStruct() {
  factories[StructureType.ArgStruct] = defineArgStruct;
}

export function getStructureName(s, full = false) {
  let r = s.name;
  if (!full) {
    r = r.replace(/{.*}/, '');
    if (!r.endsWith('.enum_literal)')) {
      r = r.replace(/[^\.\s]*?\./g, '');
    }
  }
  return r;
}

export function getStructureFactory(type) {
  const f = factories[type];
  /* DEV-TEST */
  /* c8 ignore next 10 */
  if (typeof(f) !== 'function') {
    const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
    throw new Error(`No factory for ${name}`);
  }
  /* DEV-TEST-END */
  return f;
}

export function getStructureFeature(structure) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  return `use${name}`;
}

export function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor) {
      Object.defineProperty(object, name, descriptor);
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    if (descriptor) {
      Object.defineProperty(object, symbol, descriptor);
    }
  }
}

export function removeSetters(descriptors) {
  const newDescriptors = {};
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor) {
      if (descriptor.set) {
        newDescriptors[name] = { ...descriptor, set: throwReadOnly };
      } else {
        newDescriptors[name] = descriptor;
      }
    }
  }
  return newDescriptors;
}

export function needSlots(s) {
  const { instance: { members } } = s;
  for (const { type } of members) {
    switch (type) {
      case MemberType.Object:
      case MemberType.Comptime:
      case MemberType.Type:
      case MemberType.Literal:
        return true;
    }
  }
  return false;
}

export function getSelf() {
  return this;
}

export function findAllObjects(structures, SLOTS) {
  const list = [];
  const found = new Map();
  const find = (object) => {
    if (!object || found.get(object)) {
      return;
    }
    found.set(object, true);
    list.push(object);
    if (object[SLOTS]) {
      for (const child of Object.values(object[SLOTS])) {
        find(child);         
      }
    }
  };
  for (const structure of structures) {
    find(structure.instance.template);
    find(structure.static.template);
  }
  return list;
}

export function useAllStructureTypes() {
  usePrimitive();
  useArray();
  useStruct();
  useArgStruct();
  useExternUnion();
  useBareUnion();
  useTaggedUnion();
  useErrorUnion();
  useErrorSet();
  useEnumeration();
  useOptional();
  usePointer();
  useSlice();
  useVector();
  useOpaque();
}

export class ObjectCache {
  [0] = null;
  [1] = null;

  find(dv, writable) {
    const key = (writable) ? 0 : 1;
    const map = this[key];
    return map?.get(dv);
  }

  save(dv, writable, object) {
    const key = (writable) ? 0 : 1;
    let map = this[key];    
    if (!map) {
      map = this[key] = new WeakMap();
    }
    map.set(dv, object);
    return object;
  }
}
