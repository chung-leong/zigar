import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getCopyFunction } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { addPointerAccessors } from './pointer.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { MEMORY, SLOTS, ZIG } from './symbol.js';

export function finalizeStruct(s) {
  const {
    size,
    instance: {
      members,
      template,
    },
    options,
  } = s;
  const isArgStruct = (s.type === StructureType.ArgStruct);
  const copy = getCopyFunction(size);
  const descriptors = {};
  for (const member of members) {
    const isArgument = isArgStruct && !isNaN(parseInt(member.name));
    const { get, set } = getAccessors(member, { autoDeref: !isArgument, ...options });
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const copier = s.copier = function(dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (objectMembers.length > 0) {
      dest[SLOTS] = { ...src[SLOTS] };
    }
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation--expect an object
      // TODO: validate argument
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    Object.defineProperties(self, descriptors);
    if (objectMembers.length > 0) {
      // create child objects
      const recv = (this === ZIG) ? this : null;
      const slots = {};
      for (const { structure: { constructor }, bitOffset, byteSize, slot } of objectMembers) {
        const offset = bitOffset >> 3;
        const childDV = new DataView(dv.buffer, offset, byteSize);
        slots[slot] = constructor.call(recv, childDV);
      }
      Object.defineProperties(self, {
        [SLOTS]: { value: slots, writable: true },
      });
    }
    if (creating) {
      if (template) {
        copier(this, template);
      }
      if (arg) {
        for (const [ key, value ] of Object.entries(arg)) {
          this[key] = value;
        }
      }
    } else {
      return self;
    }
  };
  if (!isArgStruct) {
    addPointerAccessors(s);
    addDataViewAccessor(s);
    addStaticMembers(s);
    addMethods(s);
  }
  return constructor;
};
