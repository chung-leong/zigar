import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getCopyFunction } from './memory.js';
import { getDataView, isBuffer } from './data-view.js';
import { MEMORY, SLOTS, SOURCE, ZIG } from './symbol.js';

export function finalizePointer(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const { get, set } = getAccessors(member, options);
  const copy = getCopyFunction(size);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    dest[SLOTS] = { ...src[SLOTS] };
  };
  const { structure: target } = member;
  const isSlice = target.type === StructureType.Slice;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    const slots = { 0: null };
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
      [SLOTS]: { value: slots, writable: true },
      // a boolean value indicating whether Zig currently owns the pointer
      [ZIG]: { value: this === ZIG, writable: true },
    });
    if (creating) {
      const { constructor } = target;
      if (!(arg instanceof constructor)) {
        const recv = (this === ZIG) ? this : null;
        arg = isBuffer(arg) ? constructor.call(recv, arg) : new constructor(arg);
      }
      slots[0] = arg;
    } else {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    '*': { get, set, configurable: true, enumerable: true },
  });
  return constructor;
}

export function addPointerAccessors(s) {
  const {
    constructor,
    instance: { members: instanceMembers },
    static: { members: staticMembers },
    options,
  } = s;
  const list = [
    [ constructor.prototype, instanceMembers ],
    [ constructor, staticMembers ],
  ];
  for (const [ target, members ] of list) {
    const descriptors = {};
    for (const member of members) {
      const accessors = getPointerAccessors(member, options);
      if (accessors) {
        descriptors[member.name] = { ...accessors, configurable: true, enumerable: true };
      }
    }
    if (Object.keys(descriptors).length > 0) {
      const prototype = Object.defineProperties({}, descriptors);
      const get = function() {
        const source = Object.create(prototype);
        source[SOURCE] = this;
        return source;
      };
      Object.defineProperties(target, {
        '&': { get, configurable: true, enumerable: true },
      });
    }
  }
}

export function getPointerAccessors(member, options) {
  if (member.type === MemberType.Object) {
    const { structure, slot } = member;
    if (structure.type === StructureType.Pointer) {
      if (slot !== undefined) {
        // get pointer from slot
        return {
          get: function() {
            const pointer = this[SOURCE][SLOTS][slot];
            return pointer;
          },
          set: function(value) {
            const { constructor, copier } = structure;
            if (!(value instanceof constructor)) {
              value = new constructor(value);
            }
            copier(this[SOURCE][SLOTS][slot], value);
          },
        };
      } else {
        return {
          get: function(index) {
            const pointer = this[SOURCE][SLOTS][index];
            return pointer;
          },
          set: function(index, value) {
            const { constructor, copier } = structure;
            if (!(value instanceof constructor)) {
              throwInvalidType(structure);
            }
            const object = this[SOURCE][SLOTS][index];
            copier(object, value);
          },
        };
      }
    }
  }
}
