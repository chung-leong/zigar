import { defineArgStruct } from './arg-struct.js';
import { defineArray } from './array.js';
import { requireDataView, setDataView } from './data-view.js';
import { defineEnumerationShape } from './enumeration.js';
import { defineErrorSet } from './error-set.js';
import { defineErrorUnion } from './error-union.js';
import { throwMissingInitializers, throwNoInitializer, throwNoProperty, throwReadOnly } from './error.js';
import { MemberType, hasStandardFloatSize, hasStandardIntSize, isByteAligned, isReadOnly } from './member.js';
import { defineOpaque } from './opaque.js';
import { defineOptional } from './optional.js';
import { copyPointer, definePointer } from './pointer.js';
import { definePrimitive } from './primitive.js';
import { defineSlice } from './slice.js';
import { defineStructShape } from './struct.js';
import {
  ALL_KEYS,
  CONST, CONST_PROTOTYPE,
  COPIER,
  GETTER,
  MEMORY,
  POINTER_VISITOR,
  PROP_SETTERS,
  SETTER,
  SLOTS,
  VIVIFICATOR
} from './symbol.js';
import { defineUnionShape } from './union.js';
import { defineVector } from './vector.js';

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternStruct: 3,
  PackedStruct: 4,
  ArgStruct: 5,
  ExternUnion: 6,
  BareUnion: 7,
  TaggedUnion: 8,
  ErrorUnion: 9,
  ErrorSet: 10,
  Enumeration: 11,
  Optional: 12,
  Pointer: 13,
  Slice: 14,
  Vector: 15,
  Opaque: 16,
  Function: 17,
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
    case MemberType.EnumerationItem: {
      features.useEnumerationItem = true;
      const { type, structure } = member.structure.instance.members[0]; 
      flagMemberUsage({ ...member, type, structure }, features);
    } break;
    case MemberType.Error:
      features.useError = true;
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
  switch (type) {
    case StructureType.Pointer:
      // pointer structure has Object member, while needing support for Uint
      features.useUint = true;
      break;
    case StructureType.Enumeration:
      // enum structure has Int/Uint member, while needing support for EnumerationItem
      features.useEnumerationItem = true;
      break;
    case StructureType.ErrorSet:
      // error set structures have Uint member, while needing support for Error
      features.useError = true;
      break;
  } 
}

export function getFeaturesUsed(structures) {
  const features = {};
  for (const structure of structures) {
    flagStructureUsage(structure, features);
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
  // create prototype for read-only objects
  const prototypeRO = {};
  Object.setPrototypeOf(prototypeRO, constructor.prototype);
  const instanceDescriptorsRO = {};
  const propSetters = {};
  for (const [ name, descriptor ] of Object.entries(instanceDescriptors)) {
    if (descriptor?.set) {
      instanceDescriptorsRO[name] = { ...descriptor, set: throwReadOnly };
      // save the setters so we can initialize read-only objects
      if (name !== '$') {
        propSetters[name] = descriptor.set;
      }
    } else if (name === 'set') {
      instanceDescriptorsRO[name] = { value: throwReadOnly, configurable: true, writable: true };
    }
  }
  const vivificate = instanceDescriptors[VIVIFICATOR]?.value;
  const vivificateDescriptor = { 
    // vivificate child objects as read-only too
    value: function(slot) { 
      return vivificate.call(this, slot, false);
    }
  };
  const { get, set } = instanceDescriptors.$;
  defineProperties(constructor.prototype, { 
    [CONST]: { value: false },
    [ALL_KEYS]: { value: Object.keys(propSetters) },
    [SETTER]: { value: set },
    [GETTER]: { value: get },
    [PROP_SETTERS]: { value: propSetters },
    ...instanceDescriptors,
  });
  defineProperties(constructor, {
    [CONST_PROTOTYPE]: { value: prototypeRO },
    ...staticDescriptors,
  }); 
  defineProperties(prototypeRO, { 
    constructor: { value: constructor, configurable: true },
    [CONST]: { value: true },
    [SETTER]: { value: throwReadOnly },
    [VIVIFICATOR]: vivificate && vivificateDescriptor,
    ...instanceDescriptorsRO,
  });
  return constructor;
}

export function createConstructor(structure, handlers, env) {
  const {
    byteSize,
    align,
    instance: { members, template },
    hasPointer,
  } = structure;
  const {
    modifier,
    initializer,
    finalizer,
    alternateCaster,
    shapeDefiner,
  } = handlers;
  const hasSlots = needSlots(members);
  // comptime fields are stored in the instance template's slots
  let comptimeFieldSlots;
  if (template?.[SLOTS]) {
    const comptimeMembers = members.filter(m => isReadOnly(m.type));
    if (comptimeMembers.length > 0) {
      comptimeFieldSlots = comptimeMembers.map(m => m.slot);
    } 
  }
  const cache = new ObjectCache();
  const constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(structure);
      }
      self = this;
      if (hasSlots) {
        self[SLOTS] = {};
      }
      if (shapeDefiner) {
        // provided by defineSlice(); the slice is different from other structures as it does not have 
        // a fixed size; memory is allocated by the slice initializer based on the argument given
        initializer.call(self, arg, fixed);
        dv = self[MEMORY]; 
      } else {
        self[MEMORY] = dv = env.allocateMemory(byteSize, align, fixed);
      }
    } else {
      if (alternateCaster) {
        // casting from number, string, etc.
        self = alternateCaster.call(this, arg, options);
        if (self !== false) {
          return self;
        }
      }
      // look for buffer
      dv = requireDataView(structure, arg, env);
      if (self = cache.find(dv, writable)) {
        return self;
      }
      self = Object.create(writable ? constructor.prototype : constructor[CONST_PROTOTYPE]);
      if (shapeDefiner) {
        setDataView.call(self, dv, structure, false, { shapeDefiner });
      } else {
        self[MEMORY] = dv;
      }
      if (hasSlots) {
        self[SLOTS] = {};
        if (hasPointer && arg instanceof constructor) {
          // copy pointer from other object
          self[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        } 
      }
    }
    if (comptimeFieldSlots) {
      for (const slot of comptimeFieldSlots) {
        self[SLOTS][slot] = template[SLOTS][slot];
      }
    }
    if (modifier) {
      modifier.call(self);
    }
    if (creating) {
      // initialize object unless it's been done already
      if (!shapeDefiner) {
        initializer.call(self, arg);
      }
      if (!writable) {
        // create object with read-only prototype
        self = Object.assign(Object.create(constructor[CONST_PROTOTYPE]), self);
      } 
    }
    if (finalizer) {
      self = finalizer.call(self);
    }
    return cache.save(dv, writable, self); 
  };
  return constructor;
}

export function createPropertyApplier(structure) {
  const { instance: { template } } = structure;  
  return function(arg) {
    const argKeys = Object.keys(arg);
    const propSetters = this[PROP_SETTERS];
    const allKeys = this[ALL_KEYS];
    // don't accept unknown props
    for (const key of argKeys) {
      if (!(key in propSetters)) {
        throwNoProperty(structure, key);
      }
    }
    // checking each name so that we would see inenumerable initializers as well
    let normalCount = 0;
    let normalFound = 0;
    let normalMissing = 0;
    let specialFound = 0;
    for (const key of allKeys) {
      const set = propSetters[key];
      if (set.special) {
        if (key in arg) {
          specialFound++;
        }
      } else {
        normalCount++;
        if (key in arg) {
          normalFound++;
        } else if (set.required) {
          normalMissing++;
        }
      }
    }
    if (normalMissing !== 0 && specialFound === 0) {
      const missing = allKeys.filter(k => propSetters[k].required && !(k in arg));
      throwMissingInitializers(structure, missing)
    }
    if (specialFound + normalFound > argKeys.length) {
      // some props aren't enumerable
      for (const key of allKeys) {
        if (key in arg) {
          if (!argKeys.includes(key)) {
            argKeys.push(key)
          }
        }
      }
    }
    // apply default values unless all properties are initialized
    if (normalFound < normalCount && specialFound === 0) {
      if (template) {
        if (template[MEMORY]) {
          this[COPIER](template);
        }
        this[POINTER_VISITOR]?.(copyPointer, { vivificate: true, source: template });
      }
    }
    for (const key of argKeys) {
      const set = propSetters[key];
      set.call(this, arg[key]);
    }
    return argKeys.length;
  };
}

export function needSlots(members) {
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
  useExternStruct();
  usePackedStruct();
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
