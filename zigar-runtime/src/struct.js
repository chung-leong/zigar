import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { getDataView } from './data-view.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { throwInvalidInitializer, throwMissingInitializers, throwNoInitializer, throwNoProperty } from './error.js';
import { MEMORY, SLOTS, ZIG, PARENT, CHILD_VIVIFICATOR, POINTER_VISITOR } from './symbol.js';
import { copyPointer } from './pointer.js';

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
    if (member.type === MemberType.Comptime) {
      // extract value of comptime field from template
      const { slot } = member;
      const pointer = template[SLOTS][slot];
      const value = pointer['*'];
      descriptors[member.name] = { value, configurable: true, enumerable: true };
      delete template[SLOTS][slot];
    } else {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, configurable: true, enumerable: true };
    }
  }
  const constructible = (members.length > 0);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
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
    if (hasObject) {
      self[SLOTS] = {};
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
  const initializer = (constructible) ? function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](true, template, copyPointer);
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
          if (hasPointer) {
            this[POINTER_VISITOR](true, template, copyPointer);
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
  if (constructible) {
    Object.defineProperty(constructor.prototype, '$', { get: getSelf, set: initializer, configurable: true });
    addSpecialAccessors(s);
    if (hasObject) {
      addChildVivificators(s);
      if (hasPointer) {
        addPointerVisitor(s);
      }
    }
  }
  addStaticMembers(s);
  addMethods(s);
  return constructor;
}

export function getSelf() {
  return this;
}

export function addChildVivificators(s) {
  const { constructor: { prototype }, instance: { members } } = s;
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const vivificators = {};
  for (const { slot, bitOffset, byteSize, structure } of objectMembers) {
    vivificators[slot] = function getChild() {
      let object = this[SLOTS][slot];
      if (!object) {
        const { constructor } = structure;
        const dv = this[MEMORY];
        const parentOffset = dv.byteOffset;
        const offset = parentOffset + (bitOffset >> 3);
        const childDV = new DataView(dv.buffer, offset, byteSize);
        object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
      }
      return object;
    };
  }
  Object.defineProperty(prototype, CHILD_VIVIFICATOR, { value: vivificators });
}

export function addPointerVisitor(s) {
  const { constructor: { prototype }, instance: { members } } = s;
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  const visitor = function visitPointers(vivificating, src, fn) {
    for (const { slot } of pointerMembers) {
      let srcChild;
      if (src) {
        srcChild = src[SLOTS][slot];
        if (!srcChild) {
          continue;
        }
      }
      const child = (vivificating) ? this[CHILD_VIVIFICATOR][slot].call(this) : this[SLOTS][slot];
      if (child) {
        child[POINTER_VISITOR](vivificating, srcChild, fn);
      }
    }
  };
  Object.defineProperty(prototype, POINTER_VISITOR, { value: visitor });
}