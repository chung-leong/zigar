import { defineProperties, getSelf } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView } from './data-view.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { always, copyPointer } from './pointer.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { throwInvalidInitializer, throwMissingInitializers, throwNoInitializer,
  throwNoProperty } from './error.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY, MEMORY_COPIER, PARENT, POINTER_VISITOR,
  SIZE, SLOTS, TEMPLATE_SLOTS } from './symbol.js';

export function finalizeStruct(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
      template,
    },
    hasPointer,
  } = s;
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getDescriptor(member, env);
  }
  const keys = Object.keys(descriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
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
    } else {
      return self;
    }
  };
  const specialKeys = getSpecialKeys(s);
  const requiredKeys = members.filter(m => m.isRequired).map(m => m.name);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        // checking each name so that we would see inenumerable initializers as well
        let found = 0;
        for (const key of keys) {
          if (key in arg) {
            found++;
          }
        }
        let requiredFound = 0;
        for (const key of requiredKeys) {
          if (key in arg) {
            requiredFound++;
          }
        }
        let specialFound = 0;
        if (!arg[MEMORY]) {
          // only look for special keys in non-zigar objects
          for (const key of specialKeys) {
            if (key in arg) {
              specialFound++;
            }
          }
        }
        // don't accept unknown enumerable props
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty(s, key);
          }
        }
        if (specialFound === 0 && requiredFound < requiredKeys.length) {
          throwMissingInitializers(s, arg);
        }
        // apply default values unless all properties are initialized
        if (template && specialFound === 0 && found < keys.length) {
          if (template[MEMORY]) {
            this[MEMORY_COPIER](template);
          }
          if (hasPointer) {
            this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        } else if (found > 0) {
          for (const key of keys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object', arg);
      }
    }
  };
  defineProperties(constructor.prototype, {
    '$': { get: getSelf, set: initializer, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, always) },
    // struct can have comptime members, which are stored in the template's slots
    [TEMPLATE_SLOTS]: template?.[SLOTS] && { value: template[SLOTS] },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s, env);
  addStaticMembers(s, env);
  addMethods(s, env);
  return constructor;
}

export function getChildVivificators(s) {
  const { instance: { members } } = s;
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
  return vivificators;
}

export function getPointerVisitor(s, visitorOptions = {}) {
  const {
    isChildActive = always,
    isChildMutable = always,
  } = visitorOptions;
  const { instance: { members } } = s;
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: (object) => {
        // make sure parent object is active, then check whether the child is active
        return isActive(this) && isChildActive.call(this, object);
      },
      isMutable: (object) => {
        return isMutable(this) && isChildMutable.call(this, object);
      },
    };
    for (const { slot } of pointerMembers) {
      if (source) {
        // when src is a the struct's template, most slots will likely be empty,
        // since pointer fields aren't likely to have default values
        const srcChild = source[SLOTS]?.[slot];
        if (!srcChild) {
          continue;
        }
        childOptions.source = srcChild;
      }
      const child = (vivificate) ? this[CHILD_VIVIFICATOR][slot].call(this) : this[SLOTS][slot];
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}
