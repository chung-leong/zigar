import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { addPointerAccessors } from './pointer.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { throwInvalidInitializer, throwMissingInitializers, throwNoProperty } from './error.js';
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
  const descriptors = {};
  for (const member of members) {
    const { get, set } = getAccessors(member, options);
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
      ...descriptors
    });
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
    }
    if (creating) {
      initializer.call(this, arg);
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
  const requiredNames = members.filter(m => m.isRequired).map(m => m.name);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (arg && typeof(arg) !== 'object') {
        throwInvalidInitializer(s, 'an object', arg);
      }
      for (const name of requiredNames) {
        if (arg?.[name] === undefined) {
          throwMissingInitializers(s, arg);
        }
      }
      const keys = (arg) ? Object.keys(arg) : [];
      for (const key of keys) {
        if (!descriptors.hasOwnProperty(key)) {
          throwNoProperty(s, key);
        }
      }
      // apply default values unless all properties are initialized
      if (template && keys.length < members.length) {
        copy(this[MEMORY], template[MEMORY]);
        if (pointerCopier) {
          pointerCopier.call(this, template);
        }
      }
      for (const key of keys) {
        this[key] = arg[key];
      }
    }
  };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMembers);
  Object.defineProperties(constructor.prototype, {
    '$': { get: getSelf, set: initializer, configurable: true },
  });
  addPointerAccessors(s);
  addDataViewAccessor(s);
  addStaticMembers(s);
  addMethods(s);
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
      if (srcSlots[slot]) {
        pointerCopier.call(destSlots[slot], srcSlots[slot]);
      }
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

export function getSelf() {
  return extractValues(this);
}

export function extractValues(object) {
  const map = new WeakMap();
  function extract(object) {
    if (object[Symbol.iterator]) {
      const { length } = object;
      const array = [];
      for (const element of object) {
        array.push(extractValues(element));
      }
      return array;
    } else if (object && typeof(object) === 'object') {
      let result = map.get(object);
      if (!result) {
        result = {};
        map.set(object, result);
        for (const [ name, child ] of Object.entries(object)) {
          result[name] = extract(child);
        }
        return result;
      }
      return result;
    } else {
      return object;
    }
  };
  return extract(object);
}
