import { ObjectCache, StructureType, attachDescriptors, getSelf, needSlots } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { requireDataView } from './data-view.js';
import { getBase64Accessors, getDataViewAccessors, getSpecialKeys, getValueOf } from './special.js';
import { getChildVivificator, getPointerVisitor, normalizeStruct } from './struct.js';
import { throwInvalidInitializer, throwMissingUnionInitializer, throwMultipleUnionInitializers,
  throwNoProperty, throwInactiveUnionProperty, throwNoInitializer } from './error.js';
import { always, copyPointer, disablePointer, resetPointer } from './pointer.js';
import { ALIGN, CHILD_VIVIFICATOR, CONST, ENUM_ITEM, ENUM_NAME, MEMORY, MEMORY_COPIER,
  POINTER_VISITOR, SIZE, SLOTS, VALUE_NORMALIZER } from './symbol.js';

export function defineUnionShape(s, env) {
  const {
    type,
    byteSize,
    align,
    instance: { members, template },
    hasPointer,
  } = s;
  const { runtimeSafety } = env;
  const isTagged = (type === StructureType.TaggedUnion);
  const exclusion = (isTagged || (type === StructureType.BareUnion && runtimeSafety));
  const memberDescriptors = {};
  const memberInitializers = {};
  const memberValueGetters = {};
  const valueMembers = (exclusion) ? members.slice(0, -1) : members;
  const selectorMember = (exclusion) ? members[members.length - 1] : null;  
  const { get: getSelector, set: setSelector } = (exclusion) ? getDescriptor(selectorMember, env) : {};
  const getActiveField = (isTagged)
  ? function() {
      const item = getSelector.call(this);
      return item[ENUM_NAME];
    }
  : function() {
      const index = getSelector.call(this);
      return valueMembers[index].name;
    };
  const setActiveField = (isTagged)
  ? function(name) {
      const { constructor } = selectorMember.structure;
      setSelector.call(this, constructor[name]);
    }
  : function(name) {
      const index = valueMembers.findIndex(m => m.name === name);
      setSelector.call(this, index);
    };
  for (const member of valueMembers) {
    const { name } = member;
    const { get: getValue, set: setValue } = getDescriptor(member, env);
    const get = (exclusion)
    ? function() {
        const currentName = getActiveField.call(this);
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
        this[POINTER_VISITOR]?.(resetPointer);
        return getValue.call(this);
      }
    : getValue;
    const set = (exclusion) 
    ? function(value) {
        const currentName = getActiveField.call(this);
        if (name !== currentName) {
          throwInactiveUnionProperty(s, name, currentName);
        }
        setValue.call(this, value);
        this[POINTER_VISITOR]?.(resetPointer);
      }
    : setValue;
    const init = (exclusion)
    ? function(value) {
        setActiveField.call(this, name);
        setValue.call(this, value);
        this[POINTER_VISITOR]?.(resetPointer);
      }
    : setValue;
    memberDescriptors[name] = { get, set, configurable: true, enumerable: true };
    memberInitializers[name] = init;
    memberValueGetters[name] = getValue;
  }
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
    return cache.save(dv, writable, self);
  };
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const keys = Object.keys(memberDescriptors);
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
              memberInitializers[key].call(this, arg[key]);
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
              memberInitializers[key].call(this, arg[key]);
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object with a single property', arg);
      }
    }
  };
  // for bare and extern union, all members will be included 
  // tagged union meanwhile will only give the entity for the active field
  const memberNames = (isTagged) ? [ '' ] : valueMembers.map(m => m.name);
  const interatorCreator = function() {
    const self = this;
    let index = 0;
    if (isTagged) {
      memberNames[0] = getActiveField.call(this);
    }
    return {
      next() {
        let value, done;
        if (index < memberNames.length) {
          const name = memberNames[index];
          // get value of field with no check
          const get = memberValueGetters[name];
          value = [ name, get.call(self) ];
          done = false;
          index++;
        } else {
          done = true;
        }
        return { value, done };
      },
    };
  };
  const isChildActive = (isTagged)
  ? function(child) {
      const name = getActiveField.call(this);
      const active = memberValueGetters[name].call(this);
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
    [Symbol.iterator]: { value: interatorCreator },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [ENUM_ITEM]: isTagged && { get: getSelector, configurable: true },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor(s, { isChildActive }) },
    [VALUE_NORMALIZER]: { value: normalizeStruct },
  };
  for (const [ name, desc ] of Object.entries(instanceDescriptors)) {
    // add setters of special props
    if (desc?.set && !memberInitializers[name]) {
      memberInitializers[name] = desc.set;
    }
  }
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function getUnionIteratorCreator(structure) {
  const { instance: { members } } = structure;
  const names = members.map(m => m.name);
  const { length } = names;
  return function getStructIterator() {
    let index = 0;
    const self = this;
    return {
      next() {
        let value, done;
        if (index < length) {
          const name = names[index];
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
}