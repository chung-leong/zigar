import { finalizePrimitive } from './primitive.js';
import { finalizeStruct } from './struct.js';
//import { finalizeTaggedUnion } from './tagged-union.js';
import { finalizeErrorUnion } from './error-union.js'
import { finalizeErrorSet } from './error-set.js';
import { finalizeEnumeration } from './enumeration.js';
import { finalizeOptional } from './optional.js';
import { finalizePointer } from './pointer.js';

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternUnion: 3,
  TaggedUnion: 4,
  ErrorUnion: 5,
  ErrorSet: 6,
  Enumeration: 7,
  Optional: 8,
  Pointer: 9,
  Slice: 10,
  Opaque: 11,
  ArgStruct: 12,
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
  factories[StructureType.ExternUnion] = finalizeStruct;
}

export function useTaggedUnion() {
  //factories[StructureType.Struct] = finalizeTaggedUnion;
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
  factories[StructureType.Slice] = finalizeArray;
}
export function useOpaque() {
  factories[StructureType.Opaque] = finalizeStruct;
}

export function useArgStruct() {
  factories[StructureType.ArgStruct] = finalizeStruct;
}

export function beginStructure(def, options = {}) {
  const {
    type,
    name,
    size,
  } = def;
  return {
    constructor: null,
    copier: null,
    type,
    name,
    size,
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
  const target = (def.isStatic) ? s.static : s.instance;
  target.members.push(def);
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
    const constructor = f(s);
    Object.defineProperties(constructor, 'name', { value: s.name, writable: false });
    return constructor;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
