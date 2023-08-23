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

export function beginStructure(def, options = {}) {
  const {
    type,
    name,
    size,
    isConst,
    hasPointer,
  } = def;
  return {
    constructor: null,
    initializer: null,
    pointerCopier: null,
    pointerResetter: null,
    pointerDisabler: null,
    typedArray: null,
    type,
    name,
    size,
    isConst,
    hasPointer,
    instance: {
      members: [],
      methods: [],
      template: null,
    },
    static: {
      members: [],
      methods: [],
      template: null,
    },
    options,
  };
}

export function attachMember(s, member, isStatic = false) {
  const target = (isStatic) ? s.static : s.instance;
  target.members.push(member);
}

export function attachMethod(s, method, isStaticOnly = false) {
  s.static.methods.push(method);
  if (!isStaticOnly) {
    s.instance.methods.push(method);
  }
}

export function attachTemplate(s, template, isStatic = false) {
  const target = (isStatic) ? s.static : s.instance;
  target.template = template;
}

export function finalizeStructure(s) {
  try {
    const f = factories[s.type];
    if (process.env.NODE_ENV !== 'production') {
      /* c8 ignore next 10 */
      if (typeof(f) !== 'function') {
        const [ name ] = Object.entries(StructureType).find(a => a[1] === s.type);
        throw new Error(`No factory for ${name}: ${f}`);
      }
    }
    const constructor = f(s);
    if (constructor) {
      Object.defineProperty(constructor, 'name', { value: s.name, writable: false });
    }
    return constructor;
    /* c8 ignore next 4 */
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export function getStructureFeature(structure) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  return `use${name}`;
}
