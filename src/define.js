import { StructureType, MemberType } from './types.js';
import { obtainGetter, obtainSetter } from './struct.js';
import { obtainArrayGetter, obtainArraySetter, obtainArrayLengthGetter, getArrayIterator } from './array.js';
import { obtainTypedArrayGetter } from './typed-array.js';
import { obtainCopyFunction } from './memory.js';
import { getDataView } from './data-view.js';
import { throwSizeMismatch } from './errors.js';
import { DATA, RELOCATABLE } from './symbols.js';
const { defineProperty } = Object;

export function defineStructure(def, options = {}) {
  const { 
    size,
    type,
    members,
    staticMembers,
    defaultData,
    defaultPointers,
    staticPointers,
    exposeDataView = false,
  } = def;
  // create prototype
  const proto = {};
  switch (type) {
    case StructureType.Primitive: {
      const [ member ] = members;
      proto.get = proto[Symbol.toPrimitive] = obtainGetter(member, options);
      proto.set = obtainSetter(member, options);
    } break;
    case StructureType.Array: {
      const [ member ] = members;
      proto.get = obtainArrayGetter(member, options);
      proto.set = obtainArraySetter(member, options);
      const getLength = obtainArrayLengthGetter(member, options);
      defineProperty(proto, 'length', { get: getLength, configurable: true, enumerable: true });
      defineProperty(proto, Symbol.iterator, { value: getArrayIterator, configurable: true });
    } break;
    case StructureType.Struct: {
      for (const member of members) {
        const get = obtainGetter(member, options);
        const set = obtainSetter(member, options);
        defineProperty(proto, member.name, { get, set, configurable: true, enumerable: true });
      } 
    } break;     
  }
  if (exposeDataView && !members.find(m => m.name === 'dataView')) {
    defineProperty(proto, 'dataView', { get: getDataView, configurable: true, enumerable: true });
    const getTypedArray = obtainTypedArrayGetter(members);
    if (getTypedArray) {
      defineProperty(proto, 'typedArray', { get: getTypedArray, configurable: true, enumerable: true });
    }
  }
  // create constructor
  const copy = obtainCopyFunction(size);
  const hasRelocatable = !!members.find(m => m.type === MemberType.Compound || m.type === MemberType.Pointer);
  const compoundMembers = members.filter(m => m.type === MemberType.Compound);
  const internalPointers = (compoundMembers.length > 0) && compoundMembers.map(({ struct, bitOffset, bits, slot }) => {
    return { struct, slot, offset: bitOffset >> 3, size: bits >> 3 };
  });
  const struct = function(arg) {
    var dv;
    if (arg instanceof ArrayBuffer || arg instanceof SharedArrayBuffer) {
      dv = new DataView(arg);
    } else if (arg instanceof DataView) {
      dv = arg;
    }
    if (dv) {
      if (dv.byteLength !== size) {
        throwSizeMismatch(dv.byteLength, size);
      }
    } else if (size > 0) {
      dv = new DataView(new ArrayBuffer(size));
      if (defaultData) {
        copy(dv, defaultData);
      }
    }   
    if (dv) {
      this[DATA] = dv;
    }
    if (hasRelocatable) {
      const relocs = this[RELOCATABLE] = {};
      if (defaultPointers) {
        for (const [ slot, value ] of Object.entries(defaultPointers)) {
          relocs[slot] = value;
        }
      }
      if (internalPointers) {
        // initialize compound members (array, struct, etc.), storing them 
        // in relocatables even through they aren't actually relocatable
        const buffer = dv.buffer;
        for (const { struct, slot, offset, size } of internalPointers) {
          const mdv = new DataView(buffer, offset, size);
          const obj = new struct(mdv);
          relocs[slot] = obj;
        }
      } 
    } 
  };  
  defineProperty(struct, 'prototype', { value: proto });
  return struct;
}
