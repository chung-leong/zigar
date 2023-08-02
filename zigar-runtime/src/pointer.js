import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
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
  const { structure: target } = member;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
      [SLOTS]: { value: { 0: null } },
      // a boolean value indicating whether Zig currently owns the pointer
      [ZIG]: { value: this === ZIG, writable: true },
    });
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const { TypedArray } = target;
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      // not doing memory copying since values stored there might not be valid anyway
      pointerCopier.call(this);
    } else {
      const Target = target.constructor;
      if (!(arg instanceof Target)) {
        // automatically cast or create target
        const recv = (this === ZIG) ? this : null;
        arg = isBuffer(arg, TypedArray) ? Target.call(recv, arg) : new Target(arg);
      }
      this[SLOTS][0] = arg;
    }
  };
  const retrieve = function() { return this };
  const pointerCopier = s.pointerCopier = function(arg) {
    this[SLOTS][0] = arg[SLOTS][0];
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    '*': { get, set, configurable: true },
    '$': { get: retrieve, set: initializer, configurable: true, },
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
        '&': { get, configurable: true },
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
            const { initializer } = structure;
            const object = this[SOURCE][SLOTS][slot];
            initializer.call(object, value);
          },
        };
      } else {
        return {
          get: function(index) {
            const pointer = this[SOURCE][SLOTS][index];
            return pointer;
          },
          set: function(index, value) {
            const { initializer } = structure;
            const object = this[SOURCE][SLOTS][index];
            initializer.call(object, value);
          },
        };
      }
    }
  }
}
