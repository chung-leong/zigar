import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { getDataView } from './data-view.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { throwInvalidInitializer, throwMissingInitializers, throwNoInitializer, throwNoProperty } from './error.js';
import { MEMORY, SLOTS, ZIG, PARENT } from './symbol.js';

export function finalizeStruct(s) {
  const {
    size,
    instance: {
      members,
      template,
    },
    hasPointer,
    options,
  } = s;
  const descriptors = {};
  for (const member of members) {
    const { get, set } = getAccessors(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  const constructible = (members.length > 0);
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const constructor = s.constructor = (constructible) ? function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    self[MEMORY] = dv;
    Object.defineProperties(self, descriptors);
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
    }
    if (creating) {
      initializer.call(self, arg);
      if (arg) {
        for (const [ key, value ] of Object.entries(arg)) {
          this[key] = value;
        }
      }
    } else {
      return self;
    }
  } : Object.create(null);
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const requiredKeys = members.filter(m => m.isRequired).map(m => m.name);
  const initializer = s.initializer = (constructible) ? function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        let found = 0;
        let requiredFound = 0;
        let specialInit = false;
        for (const key of keys) {
          if (descriptors.hasOwnProperty(key)) {
            found++;
            if (requiredKeys.includes(key)) {
              requiredFound++;
            }
          } else if (specialKeys.includes(key)) {
            specialInit = true;
          } else {
            throwNoProperty(s, key);
          }
        }
        if (!specialInit && requiredFound < requiredKeys.length) {
          throwMissingInitializers(s, arg);
        }
        // apply default values unless all properties are initialized
        if (template && !specialInit && found < members.length) {
          copy(this[MEMORY], template[MEMORY]);
          if (pointerCopier) {
            pointerCopier.call(this, template);
          }
        }
        for (const key of keys) {
          this[key] = arg[key];
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object', arg);
      }
    }
  } : null;
  const pointerCopier = s.pointerCopier = (hasPointer) ? getPointerCopier(objectMembers) : null;
  const pointerResetter = s.pointerResetter = (hasPointer) ? getPointerResetter(objectMembers) : null;
  const pointerDisabler = s.pointerDisabler = (hasPointer) ? getPointerDisabler(objectMembers) : null;
  if ((constructible)) {
    const retriever = function() { return this };
    Object.defineProperty(constructor.prototype, '$', { get: retriever, set: initializer, configurable: true });
    addSpecialAccessors(s);
  }
  addStaticMembers(s);
  addMethods(s);
  return constructor;
};

export function createChildObjects(members, recv) {
  const dv = this[MEMORY];
  const slots = this[SLOTS] = {};
  if (recv !== ZIG)  {
    recv = PARENT;
  }
  const parentOffset = dv.byteOffset;
  for (const { structure: { constructor }, bitOffset, byteSize, slot } of members) {
    const offset = parentOffset + (bitOffset >> 3);
    const childDV = new DataView(dv.buffer, offset, byteSize);
    slots[slot] = constructor.call(recv, childDV);
  }
}

export function getPointerCopier(members) {
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function(src) {
    const destSlots = this[SLOTS];
    const srcSlots = src[SLOTS];
    for (const { slot, structure: { pointerCopier } } of pointerMembers) {
      pointerCopier.call(destSlots[slot], srcSlots[slot]);
    }
  };
}

export function getPointerResetter(members) {
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function() {
    const destSlots = this[SLOTS];
    for (const { slot, structure: { pointerResetter } } of pointerMembers) {
      pointerResetter.call(destSlots[slot]);
    }
  };
}

export function getPointerDisabler(members) {
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function() {
    const destSlots = this[SLOTS];
    for (const { slot, structure: { pointerDisabler } } of pointerMembers) {
      pointerDisabler.call(destSlots[slot]);
    }
  };
}
