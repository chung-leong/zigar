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
import { finalizeArgStruct } from './arg-struct.js';

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternUnion: 3,
  BareUnion: 4,
  TaggedUnion: 5,
  ErrorUnion: 6,
  ErrorSet: 7,
  Enumeration: 8,
  Optional: 9,
  Pointer: 10,
  Slice: 11,
  Opaque: 12,
  ArgStruct: 13,
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
    hasPointer,
  } = def;
  return {
    constructor: null,
    initializer: null,
    pointerCopier: null,
    pointerResetter: null,
    typedArray: null,
    type,
    name,
    size,
    hasPointer,
    instance: {
      members: [],
      template: null,
    },
    static: {
      members: [],
      template: null,
    },
    methods: [],
    options,
  };
}

export function attachMember(s, def) {
  const { isStatic, ...member } = def;
  const target = (isStatic) ? s.static : s.instance;
  target.members.push(member);
}

export function attachMethod(s, def) {
  s.methods.push(def);
}

export function attachTemplate(s, def) {
  const target = (def.isStatic) ? s.static : s.instance;
  target.template = def.template;
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
