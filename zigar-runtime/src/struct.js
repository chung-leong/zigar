import { ObjectCache, attachDescriptors, getSelf, needSlots } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { requireDataView } from './data-view.js';
import { always, copyPointer } from './pointer.js';
import { getBase64Accessors, getDataViewAccessors, getSpecialKeys, 
  getValueOf } from './special.js';
import { throwInvalidInitializer, throwMissingInitializers, throwNoInitializer, 
  throwNoProperty } from './error.js';
import { ALIGN, CHILD_VIVIFICATOR, CONST, MEMORY, MEMORY_COPIER, PARENT, POINTER_VISITOR, SIZE, 
  SLOTS, 
  VALUE_NORMALIZER} from './symbol.js';

export function defineStructShape(s, env) {
  const {
    byteSize,
    align,
    instance: { members, template },
    hasPointer,
  } = s;  
  const memberDescriptors = {};
  const memberSetters = {};
  for (const member of members) {
    const { get, set } = getDescriptor(member, env);
    memberDescriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  const keys = Object.keys(memberDescriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const hasSlots = needSlots(s);
  const comptimeMembers = members.filter(m => m.type === MemberType.Comptime);
  const cache = new ObjectCache();
  // comptime fields are stored in the instance template's slots
  const constructor = s.constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = (writable) ? this : Object.create(constructor[CONST].prototype);
      dv = env.allocateMemory(byteSize, align, fixed);
    } else {
      dv = requireDataView(s, arg, env);
      if (self = cache.find(dv, writable)) {
        return self;
      }
      const c = (writable) ? constructor : constructor[CONST];
      self = Object.create(c.prototype);
    }
    self[MEMORY] = dv;
    if (hasSlots) {
      self[SLOTS] = {};
      if (comptimeMembers.length > 0 && template?.[SLOTS]) {
        for (const { slot } of comptimeMembers) {
          self[SLOTS][slot] = template[SLOTS][slot];
        } 
      }
    }
    if (creating) {
      initializer.call(self, arg);
    }
    return cache.save(dv, writable, self);
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
        if (specialFound === 0 && found < keys.length) {
          if (template) {
            if (template[MEMORY]) {
              this[MEMORY_COPIER](template);
            }
            if (hasPointer) {
              this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
            } 
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              memberSetters[key].call(this, arg[key]);
            }
          }
        } else if (found > 0) {
          for (const key of keys) {
            if (key in arg) {
              memberSetters[key].call(this, arg[key]);
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object', arg);
      }
    }
  };
  const memberNames = members.map(m => m.name);
  const interatorCreator = function() {
    const self = this;
    let index = 0;
    return {
      next() {
        let value, done;
        if (index < memberNames.length) {
          const name = memberNames[index];
          value = [ name, self[name] ];
          done = false;
          index++;
        } else {
          done = true;
        }
        return { value, done };
      },
    };
  };
  const instanceDescriptors = {
    ...memberDescriptors,
    $: { get: getSelf, set: initializer },
    dataView: getDataViewAccessors(s),
    base64: getBase64Accessors(),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: { value: interatorCreator },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s, true) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, always) },
    [VALUE_NORMALIZER]: { value: normalizeStruct },
  };
  // need setters for initialization of read-only objects
  for (const [ name, desc ] of Object.entries(instanceDescriptors)) {
    if (desc?.set) {
      memberSetters[name] = desc.set;
    }
  }
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeStruct(map) {
  let object = map.get(this);
  if (!object) {
    object = {};
    for (const [ name, value ] of this) {      
      object[name] = value[VALUE_NORMALIZER]?.(map) ?? value;
    }
    map.set(this, object);
  }
  return object;
}

export function getChildVivificator(structure) {
  const { instance: { members } } = structure;
  const objectMembers = {};
  for (const member of members.filter(m => m.type === MemberType.Object)) {
    objectMembers[member.slot] = member;
  }
  return function vivificateChild(slot, writable = true) {
    const { bitOffset, byteSize, structure: { constructor } } = objectMembers[slot];
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + (bitOffset >> 3);
    const childDV = new DataView(dv.buffer, offset, byteSize);
    const object = this[SLOTS][slot] = constructor.call(PARENT, childDV, { writable });
    return object;
  }
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
      const child = this[SLOTS][slot] ?? (vivificate ? this[CHILD_VIVIFICATOR](slot) : null);
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}
