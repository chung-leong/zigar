import { ObjectCache, StructureType, attachDescriptors, getSelf, needSlots } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { requireDataView } from './data-view.js';
import { getBase64Accessors, getDataViewAccessors, getSpecialKeys, getValueOf } from './special.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { throwInvalidInitializer, throwMissingUnionInitializer, throwMultipleUnionInitializers,
  throwNoProperty, throwInactiveUnionProperty, throwNoInitializer } from './error.js';
import { always, copyPointer, disablePointer, resetPointer } from './pointer.js';
import { ACTIVE_FIELD, ALIGN, CHILD_VIVIFICATOR, CONST, ENUM_ITEM, ENUM_NAME, MEMORY, MEMORY_COPIER,
  POINTER_VISITOR, PROXY, SIZE, SLOTS, VALUE_NORMALIZER } from './symbol.js';

export function defineUnionShape(s, env) {
  const {
    type,
    byteSize,
    align,
    instance: { members, template },
    hasPointer,
  } = s;
  const { runtimeSafety } = env;
  let getEnumItem;
  let valueMembers;
  let getName, setName;
  const isTagged = (type === StructureType.TaggedUnion);
  const exclusion = (isTagged || (type === StructureType.BareUnion && runtimeSafety));
  const memberDescriptors = {};
  if (exclusion) {
    valueMembers = members.slice(0, -1);
    const selectorMember = members[members.length - 1];
    const { get: getSelector, set: setSelector } = getDescriptor(selectorMember, env);
    if (type === StructureType.TaggedUnion) {
      const { structure: { constructor } } = selectorMember;
      getEnumItem = getSelector;
      getName = function() {
        const item = getSelector.call(this);
        return item[ENUM_NAME];
      };
      setName = function(name) {
        setSelector.call(this, constructor[name]);
      };
    } else {
      const names = valueMembers.map(m => m.name);
      getName = function() {
        const index = getSelector.call(this);
        return names[index];
      };
      setName = function(name) {
        const index = names.indexOf(name);
        setSelector.call(this, index);
      };
    }
    const pointerSlots = {};
    for (const member of valueMembers) {
      const { name, slot, structure: { hasPointer } } = member;
      const { get: getValue, set: setValue } = getDescriptor(member, env);
      const update = function(name) {
        const prevActiveField = this[ACTIVE_FIELD];
        if (prevActiveField !== name) {
          this[ACTIVE_FIELD] = name;
          if (prevActiveField) {
            // release pointers in deactivated field
            const slot = pointerSlots[prevActiveField];
            if (slot !== undefined) {
              const object = this[SLOTS][slot];
              object?.[POINTER_VISITOR](resetPointer);  
            }
          }
        }
      };
      const get = function() {
        const currentName = getName.call(this);
        update.call(this, currentName);
        if (name !== currentName) {
          if (isTagged) {
            // tagged union allows inactive member to be queried
            return null;
          } else {
            // whereas bare union does not, since the condition is not detectable 
            // when runtime safety is off
            throwInactiveUnionProperty(s, name, currentName);
          }
        }
        return getValue.call(this);
      };
      const set = function(value) {
        const currentName = getName.call(this);
        update.call(this, currentName);
        if (name !== currentName) {
          throwInactiveUnionProperty(s, name, currentName);
        }
        setValue.call(this, value);
      };
      const init = function(value) {
        setName.call(this, name);
        setValue.call(this, value);
        update.call(this, name);
      };
      if (hasPointer) {
        pointerSlots[name] = slot;
      }
      memberDescriptors[member.name] = { get, set, init, update, configurable: true, enumerable: true };
    }
  } else {
    // extern union or bare union with runtime safety disabled
    valueMembers = members;
    for (const member of members) {
      const { get, set } = getDescriptor(member, env);
      memberDescriptors[member.name] = { get, set, init: set, configurable: true, enumerable: true };
    }
  }
  if (isTagged) {
    memberDescriptors[ACTIVE_FIELD] = { value: undefined, writable: true };
  }
  const keys = Object.keys(memberDescriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
  const hasSlots = needSlots(s);
  const cache = new ObjectCache();
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
    }
    if (hasInaccessiblePointer) {
      // make pointer access throw
      self[POINTER_VISITOR](disablePointer, { vivificate: true });
    }
    if (creating) {
      initializer.call(self, arg);
    }
    if (isTagged) {
      const proxy = new Proxy(self, taggedProxyHandlers);
      Object.defineProperty(self, PROXY, { value: proxy });
      return cache.save(dv, writable, proxy);
    } else {
      return cache.save(dv, writable, self);
    }
  };
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY-END */
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
        let specialFound = 0;
        if (!arg[MEMORY]) {
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
        if (found !== 1) {
          if (found === 0) {
            if (specialFound === 0 && !hasDefaultMember) {
              throwMissingUnionInitializer(s, arg, exclusion);
            }
          } else {
            throwMultipleUnionInitializers(s);
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        } else if (found === 0) {
          if (template) {
            if (template[MEMORY]) {
              this[MEMORY_COPIER](template);
            }
            if (hasPointer) {
              this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
            }
          }
        } else {
          for (const key of keys) {
            if (key in arg) {
              // can't just set the property, since it would throw when a field other than the
              // active one is being set
              const { init } = memberDescriptors[key];
              init.call(this, arg[key]);
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object with a single property', arg);
      }
    }
  };
  const isChildActive = (isTagged)
  ? function(child) {
      const name = getName.call(this);
      const active = this[name];
      return child === active;
    }
  : always;
  const hasAnyPointer = hasPointer || hasInaccessiblePointer;
  const instanceDescriptors = {
    ...memberDescriptors,
    $: { get: getSelf, set: initializer, configurable: true },
    dataView: getDataViewAccessors(s),
    base64: getBase64Accessors(),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [ENUM_ITEM]: isTagged && { get: getEnumItem, configurable: true },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor(s, { isChildActive }) },
    [VALUE_NORMALIZER]: { value: createNormalizationFunction(s) },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function createNormalizationFunction(s) {
  // TODO
  return function normalizeUnion(map) {
    return null;
  };
}

const taggedProxyHandlers = {
  ownKeys(union) {
    const item = union[ENUM_ITEM];
    const name = item[ENUM_NAME];
    return [ name, MEMORY, ACTIVE_FIELD, PROXY ];
  },
};