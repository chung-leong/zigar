import { defineArgStruct } from './arg-struct.js';
import { defineArray } from './array.js';
import { defineEnumerationShape } from './enumeration.js';
import { defineErrorSet } from './error-set.js';
import { defineErrorUnion } from './error-union.js';
import { useEnumerationTransform, useErrorSetTransform, useUint } from './member.js';
import { defineOpaque } from './opaque.js';
import { defineOptional } from './optional.js';
import { definePointer } from './pointer.js';
import { definePrimitive } from './primitive.js';
import { defineSlice } from './slice.js';
import { defineStructShape } from './struct.js';
import {
  MemberType, StructureType, hasStandardFloatSize, hasStandardIntSize, isByteAligned
} from './types.js';
import { defineUnionShape } from './union.js';
import { defineVector } from './vector.js';

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

export function usePackedStruct() {
  factories[StructureType.PackedStruct] = defineStructShape;
}

export function useExternStruct() {
  factories[StructureType.ExternStruct] = defineStructShape;
}

export function useArgStruct() {
  factories[StructureType.ArgStruct] = defineArgStruct;
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
  useErrorSetTransform();
}

export function useEnum() {
  factories[StructureType.Enum] = defineEnumerationShape;
  useEnumerationTransform();
}

export function useOptional() {
  factories[StructureType.Optional] = defineOptional;
}

export function useSinglePointer() {
  factories[StructureType.SinglePointer] = definePointer;
  useUint();
}

export function useSlicePointer() {
  factories[StructureType.SlicePointer] = definePointer;
  useUint();
}

export function useMultiPointer() {
  factories[StructureType.MultiPointer] = definePointer;
  useUint();
}

export function useCPointer() {
  factories[StructureType.CPointer] = definePointer;
  useUint();
}

export function useSlice() {
  factories[StructureType.Slice] = defineSlice;
}

export function useVector() {
  factories[StructureType.Vector] = defineVector;
}

export function useOpaque() {
  factories[StructureType.Opaque] = defineOpaque;
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

function flagMemberUsage(member, features) {
  const { type } = member;
  switch (type) {
    case MemberType.Bool:
      features.useBool = true;
      if (!isByteAligned(member)) {
        features.useExtendedBool = true;
      }
      break;
    case MemberType.Int:
      features.useInt = true;
      if(!isByteAligned(member) || !hasStandardIntSize(member)) {
        features.useExtendedInt = true;
      }
      break;
    case MemberType.Uint:
      features.useUint = true;
      if(!isByteAligned(member) || !hasStandardIntSize(member)) {
        features.useExtendedUint = true;
      }
      break;
    case MemberType.Float:
      features.useFloat = true;
      if (!isByteAligned(member) || !hasStandardFloatSize(member)) {
        features.useExtendedFloat = true;
      }
      break;
    case MemberType.Object:
      features.useObject = true;
      break;
    case MemberType.Void:
      features.useVoid = true;
      break;
    case MemberType.Null:
      features.useNull = true;
      break;
    case MemberType.Undefined:
      features.useUndefined = true;
      break;
    case MemberType.Type:
      features.useType = true;
      break;
    case MemberType.Comptime:
      features.useComptime = true;
      break;
    case MemberType.Static:
      features.useStatic = true;
      break;
    case MemberType.Literal:
      features.useLiteral = true;
      break;
    case MemberType.Unsupported:
      features.useUnsupported = true;
      break;
  }
}

function flagStructureUsage(structure, features) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  features[`use${name}`] = true;
  for (const members of [ structure.instance.members, structure.static.members ]) {
    for (const member of members) {
      flagMemberUsage(member, features);
    }
  }
}

export function getFeaturesUsed(structures) {
  const features = {};
  for (const structure of structures) {
    flagStructureUsage(structure, features);
  }
  return Object.keys(features);
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
  useExternStruct();
  usePackedStruct();
  useArgStruct();
  useExternUnion();
  useBareUnion();
  useTaggedUnion();
  useErrorUnion();
  useErrorSet();
  useEnum();
  useOptional();
  useSinglePointer();
  useSlicePointer();
  useMultiPointer();
  useCPointer();
  useSlice();
  useVector();
  useOpaque();
}
