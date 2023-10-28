import { finalizePrimitive } from './primitive.js';
import { finalizeArray } from './array.js';
import { finalizeStruct } from './struct.js';
import { finalizeUnion } from './union.js';
import { finalizeErrorUnion } from './error-union.js'
import { finalizeErrorSet } from './error-set.js';
import { finalizeEnumeration } from './enumeration.js';
import { finalizeOptional } from './optional.js';
import { finalizePointer } from './pointer.js';
import { finalizeSlice } from './slice.js';
import { finalizeVector } from './vector.js';
import { finalizeArgStruct } from './arg-struct.js';

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
  factories[StructureType.Primitive] = finalizePrimitive;
}

export function useArray() {
  factories[StructureType.Array] = finalizeArray;
}

export function useStruct() {
  factories[StructureType.Struct] = finalizeStruct;
}

export function useExternUnion() {
  factories[StructureType.ExternUnion] = finalizeUnion;
}

export function useBareUnion() {
  factories[StructureType.BareUnion] = finalizeUnion;
}

export function useTaggedUnion() {
  factories[StructureType.TaggedUnion] = finalizeUnion;
}

export function useErrorUnion() {
  factories[StructureType.ErrorUnion] = finalizeErrorUnion;
}

export function useErrorSet() {
  factories[StructureType.ErrorSet] = finalizeErrorSet;
}

export function useEnumeration() {
  factories[StructureType.Enumeration] = finalizeEnumeration;
}

export function useOptional() {
  factories[StructureType.Optional] = finalizeOptional;
}

export function usePointer() {
  factories[StructureType.Pointer] = finalizePointer;
}

export function useSlice() {
  factories[StructureType.Slice] = finalizeSlice;
}

export function useVector() {
  factories[StructureType.Vector] = finalizeVector;
}

export function useOpaque() {
  factories[StructureType.Opaque] = finalizeStruct;
}

export function useArgStruct() {
  factories[StructureType.ArgStruct] = finalizeArgStruct;
}

export function getStructureName(s, full = false) {
  let r = s.name;
  if (!full) {
    r = r.replace(/{.*}/, '');
    r = r.replace(/[^. ]*?\./g, '');
  }
  return r;
}

export function getStructureFactory(type) {
  const f = factories[type];
  if (process.env.ZIGAR_DEV) {
    /* c8 ignore next 10 */
    if (typeof(f) !== 'function') {
      const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
      throw new Error(`No factory for ${name}`);
    }
  }
  return f;
}

export function getStructureFeature(structure) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  return `use${name}`;
}
