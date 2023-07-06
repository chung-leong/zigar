import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
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
  const descriptors = {};
  for (const member of members) {
    const isArgument = isArgStruct && !isNaN(parseInt(member.name));
    const { get, set } = getAccessors(member, { autoDeref: !isArgument, ...options });
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  const objectMembers = members.filter(m => m.type === MemberType.Object);
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
      [MEMORY]: { value: dv },
    });
    Object.defineProperties(self, descriptors);
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
    }
    if (creating) {
      initializer.call(this);
      if (arg) {
        for (const [ key, value ] of Object.entries(arg)) {
          this[key] = value;
        }
      }
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (template) {
        copy(this[MEMORY], template[MEMORY]);
        if (pointerCopier) {
          pointerCopier.call(this, template);
        }
      }
      // TODO: validation
      if (arg) {
        for (const [ key, value ] of Object.entries(arg)) {
          this[key] = value;
        }
      }
    }
  };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMembers);
  if (!isArgStruct) {
    addPointerAccessors(s);
    addDataViewAccessor(s);
    addStaticMembers(s);
    addMethods(s);
  }
  return constructor;
};

export function createChildObjects(members, recv, dv) {
  const slots = {};
  if (recv !== ZIG)  {
    recv = null;
  }
  for (const { structure: { constructor }, bitOffset, byteSize, slot } of members) {
    const offset = bitOffset >> 3;
    const childDV = new DataView(dv.buffer, offset, byteSize);
    slots[slot] = constructor.call(recv, childDV);
  }
  Object.defineProperties(this, {
    [SLOTS]: { value: slots },
  });
}

export function getPointerCopier(members) {
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  if (pointerMembers.length === 0) {
    return null;
  }
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
  if (pointerMembers.length === 0) {
    return null;
  }
  return function() {
    const destSlots = this[SLOTS];
    for (const { slot, structure: { pointerResetter } } of pointerMembers) {
      pointerResetter.call(destSlots[slot]);
    }
  };
}
