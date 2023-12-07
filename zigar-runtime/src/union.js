import { StructureType, defineProperties, getSelf } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView } from './data-view.js';
import { addMethods } from './method.js';
import { getSpecialKeys } from './special.js';
import { getChildVivificators, getPointerVisitor } from './struct.js';
import { throwInvalidInitializer, throwMissingUnionInitializer, throwMultipleUnionInitializers,
  throwNoProperty, throwInactiveUnionProperty, throwNoInitializer } from './error.js';
import { copyPointer, disablePointer, resetPointer } from './pointer.js';
import { ALIGN, CHILD_VIVIFICATOR, ENUM_ITEM, ENUM_NAME, MEMORY, MEMORY_COPIER, POINTER_VISITOR,
  SIZE, SLOTS, TAG } from './symbol.js';

export function defineUnionShape(s, env) {
  const {
    type,
    byteSize,
    align,
    instance: {
      members,
      template,
    },
    hasPointer,
  } = s;
  const { runtimeSafety } = env;
  const descriptors = {};
  let getEnumItem;
  let valueMembers;
  const isTagged = (type === StructureType.TaggedUnion);
  const exclusion = (isTagged || (type === StructureType.BareUnion && runtimeSafety));
  let getName, setName;
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
    for (const member of valueMembers) {
      const { name, slot, structure: { hasPointer } } = member;
      const { get: getValue, set: setValue } = getDescriptor(member, env);
      const update = (isTagged) ? function(name) {
        if (this[TAG]?.name !== name) {
          this[TAG]?.clear?.();
          this[TAG] = { name };
          if (hasPointer) {
            this[TAG].clear = () => {
              const object = this[SLOTS][slot];
              object[POINTER_VISITOR](resetPointer);
            };
          }
        }
      } : null;
      const get = function() {
        const currentName = getName.call(this);
        update?.call(this, currentName);
        if (name !== currentName) {
          if (isTagged) {
            return null;
          } else {
            throwInactiveUnionProperty(s, name, currentName);
          }
        }
        return getValue.call(this);
      };
      const set = function(value) {
        const currentName = getName.call(this);
        update?.call(this, currentName);
        if (name !== currentName) {
          throwInactiveUnionProperty(s, name, currentName);
        }
        setValue.call(this, value);
      };
      const init = function(value) {
        setName.call(this, name);
        setValue.call(this, value);
        update?.call(this, name);
      };
      descriptors[member.name] = { get, set, init, update, configurable: true, enumerable: true };
    }
  } else {
    // extern union
    valueMembers = members;
    for (const member of members) {
      const { get, set } = getDescriptor(member, env);
      descriptors[member.name] = { get, set, init: set, configurable: true, enumerable: true };
    }
  }
  if (isTagged) {
    descriptors[TAG] = { value: null, writable: true };
  }
  const keys = Object.keys(descriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
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
    defineProperties(self, descriptors);
    if (hasObject) {
      self[SLOTS] = {};
      if (hasInaccessiblePointer) {
        // make pointer access throw
        self[POINTER_VISITOR](disablePointer, { vivificate: true });
      }
    }
    if (creating) {
      initializer.call(self, arg);
    }
    if (isTagged) {
      return new Proxy(self, taggedProxyHandlers);
    } else {
      return (creating) ? undefined : self;
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
            this[MEMORY_COPIER](template);
            if (hasPointer) {
              this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
            }
          }
        } else {
          for (const key of keys) {
            if (key in arg) {
              // can't just set the property, since it would throw when a field other than the
              // active one is being set
              const { init } = descriptors[key];
              init.call(this, arg[key]);
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object with a single property', arg);
      }
    }
  };
  const isChildActive = function(child) {
    const name = getName.call(this);
    const active = this[name];
    return child === active;
  };
  const hasAnyPointer = hasPointer || hasInaccessiblePointer;
  defineProperties(constructor.prototype, {
    '$': { get: getSelf, set: initializer, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [ENUM_ITEM]: isTagged && { get: getEnumItem, configurable: true },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor(s, { isChildActive }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
};

const taggedProxyHandlers = {
  ownKeys(union) {
    const item = union[ENUM_ITEM];
    const name = item[ENUM_NAME];
    return [ name, MEMORY, TAG ];
  },
};