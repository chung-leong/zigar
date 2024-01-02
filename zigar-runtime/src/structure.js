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
import { MemberType, hasStandardFloatSize, hasStandardIntSize, isByteAligned } from './member.js';
import { CHILD_VIVIFICATOR, CONST } from './symbol.js';

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

export function getFeaturesUsed(structures) {
  const features = {};
  for (const structure of structures) {
    const { type } = structure;
    const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
    features[`use${name}`] = true;
    for (const members of [ structure.instance.members, structure.static.members ]) {
      for (const member of members) {
        const { type, bitSize } = member;
        switch (type) {
          case MemberType.Int:
            if(isByteAligned(member) && hasStandardIntSize(member)) {
              features.useInt = true;
            } else {
              features.useIntEx = true;
            }
            break;
          case MemberType.Uint:
            if(isByteAligned(member) && hasStandardIntSize(member)) {
              features.useUint = true;
            } else {
              features.useUintEx = true;
            }
            break;
          case MemberType.EnumerationItem:
            if(isByteAligned(member) && hasStandardIntSize(member)) {
              features.useEnumerationItem = true;
            } else {
              features.useEnumerationItemEx = true;
            }
            break;
          case MemberType.Error:
            features.useError = true;
            break;
          case MemberType.Float:
            if (isByteAligned(member) && hasStandardFloatSize(member)) {
              features.useFloat = true;
            } else {
              features.useFloatEx = true;
            }
            break;
          case MemberType.Bool:
            if (isByteAligned(member)) {
              features.useBool = true;
            } else {
              features.useBoolEx = true;
            }
            break;
          case MemberType.Object:
            features.useObject = true;
            break;
          case MemberType.Void:
            features.useVoid = true;
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
        }         
      }
    }
    switch (type) {
      case StructureType.Pointer:
        // pointer structure have Object member, while needing support for Uint
        features.useUint = true;
        break;
      case StructureType.Enumeration: {
        // enumeration structures have Int/Uint member, while needing support for EnumerationItem
        const [ member ] = structure.instance.members;
        if(isByteAligned(member) && hasStandardIntSize(member)) {
          features.useEnumerationItem = true;
        } else {
          features.useEnumerationItemEx = true;
        }
      } break;
      case StructureType.ErrorSet:
        // error set structures have Uint member, while needing support for Error
        features.useError = true;
        break;
    } 
  }
  if (features.useIntEx) {
    delete features.useInt;
  }
  if (features.useUintEx) {
    delete features.useUint;
  }
  if (features.useEnumerationItemEx) {
    delete features.useEnumerationItem;
  }
  if (features.useFloatEx) {
    delete features.useFloat;
  }
  if (features.useBoolEx) {
    delete features.useBool;
  }
  return Object.keys(features);
}

export function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor) {
      const { 
        set,
        get,
        value,
        enumerable,
        configurable = true,
        writable = true,
      } = descriptor;
      Object.defineProperty(object, name, (get) 
        ? { get, set, configurable, enumerable } 
        : { value, configurable, enumerable, writable }
      );
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    if (descriptor) {
      Object.defineProperty(object, symbol, descriptor);
    }
  }
}

export function attachDescriptors(constructor, instanceDescriptors, staticDescriptors) {
  // create constructor for read-only objects (not actually accessible)
  const constructorRO = function() {};
  Object.setPrototypeOf(constructorRO.prototype, constructor.prototype);
  Object.setPrototypeOf(constructorRO, constructor);
  // replace constructor in prototype
  Object.defineProperty(constructorRO.prototype, 'constructor', { value: constructor, configurable: true });
  // inherit name from regular constructor
  delete constructorRO.name;
  instanceDescriptors[CONST] = { value: false };
  staticDescriptors[CONST] = { value: constructorRO };
  const instanceDescriptorsRO = {};
  for (const [ name, descriptor ] of Object.entries(instanceDescriptors)) {
    if (descriptor?.set) {
      instanceDescriptorsRO[name] = { ...descriptor, set: throwReadOnly };
    } else if (name === 'set') {
      instanceDescriptorsRO[name] = { value: throwReadOnly, configurable: true, writable: true };
    }
  }
  const vivificateDescriptor = instanceDescriptors[CHILD_VIVIFICATOR];
  if (vivificateDescriptor) {
  // vivificate child objects as read-only too
  const vivificate = vivificateDescriptor.value;
    const vivificateRO = function(slot) {
      return vivificate.call(this, slot, false);
    };
    instanceDescriptorsRO[CHILD_VIVIFICATOR] = { value: vivificateRO };
  }
  instanceDescriptorsRO[CONST] = { value: true };
  defineProperties(constructor.prototype, instanceDescriptors);
  defineProperties(constructor, staticDescriptors); 
  defineProperties(constructorRO.prototype, instanceDescriptorsRO);
  return constructor;
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
