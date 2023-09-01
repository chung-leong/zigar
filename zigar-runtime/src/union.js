import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { getDataView } from './data-view.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addSpecialAccessors, getSpecialKeys } from './special.js';
import { createChildObjects, getPointerCopier, getPointerResetter, getPointerDisabler } from './struct.js';
import {
  throwInvalidInitializer,
  throwMissingUnionInitializer,
  throwMultipleUnionInitializers,
  throwNoProperty,
  throwInactiveUnionProperty,
  throwNoInitializer,
} from './error.js';
import { MEMORY, ENUM_INDEX, ENUM_ITEM, CLEAR_PREVIOUS, SLOTS } from './symbol.js';

export function finalizeUnion(s) {
  const {
    type,
    size,
    instance: {
      members,
      template,
    },
    options,
    hasPointer,
  } = s;
  const {
    runtimeSafety = true,
  } = options;
  const descriptors = {};
  let getEnumItem;
  let showDefault;
  let valueMembers;
  const exclusion = (type === StructureType.TaggedUnion || (type === StructureType.BareUnion && runtimeSafety));
  if (exclusion) {
    const selectorMember = members[members.length - 1];
    const { get: getSelector, set: setSelector } = getAccessors(selectorMember, options);
    let getIndex, setIndex;
    if (type === StructureType.TaggedUnion) {
      // rely on the enumeration constructor to translate the enum values into indices
      const { structure: { constructor } } = selectorMember;
      getEnumItem = getSelector;
      getIndex = function() {
        const item = getSelector.call(this);
        return item[ENUM_INDEX];
      };
      setIndex = function(index) {
        setSelector.call(this, constructor(index));
      };
    } else {
      getIndex = getSelector;
      setIndex = setSelector;
    }
    showDefault = function() {
      const index = getIndex.call(this);
      const { name } = members[index];
      Object.defineProperty(this, name, { enumerable: true });
    };
    valueMembers = members.slice(0, -1);
    for (const [ index, member ] of valueMembers.entries()) {
      const { get: getValue, set: setValue } = getAccessors(member, options);
      const isTagged = (type === StructureType.TaggedUnion);
      const get = function() {
        const currentIndex = getIndex.call(this);
        if (index !== currentIndex) {
          if (isTagged) {
            return null;
          } else {
            throwInactiveUnionProperty(s, index, currentIndex);
          }
        }
        return getValue.call(this);
      };
      const set = function(value) {
        const currentIndex = getIndex.call(this);
        if (index !== currentIndex) {
          throwInactiveUnionProperty(s, index, currentIndex);
        }
        setValue.call(this, value);
      };
      const show = function() {
        const { name, slot, structure: { pointerResetter } } = member;
        const clear = () => {
          Object.defineProperty(this, name, { enumerable: false });
          if (pointerResetter) {
            const object = this[SLOTS][slot];
            pointerResetter.call(object);
          }
        };
        Object.defineProperties(this, {
          [name]: { enumerable: true },
          [CLEAR_PREVIOUS]: { value: clear, configurable: true },
        });
      };
      const init = function(value) {
        this[CLEAR_PREVIOUS]?.call();
        setIndex.call(this, index);
        setValue.call(this, value);
        show.call(this);
      };
      descriptors[member.name] = { get, set, init, configurable: true };
    }
  } else {
    // extern union
    valueMembers = members;
    for (const member of members) {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, init: set, configurable: true, enumerable: true };
    }
  }
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const hasInaccessiblePointer = !hasPointer && !!objectMembers.find(m => m.structure.hasPointer);
  const constructor = s.constructor = function(arg) {
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
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true, writable: true },
    });
    Object.defineProperties(self, descriptors);
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
      if (hasInaccessiblePointer) {
        pointerDisabler.call(self);
      }
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const initializer = s.initializer = function(arg) {
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
        let specialInit = false;
        for (const key of keys) {
          if (descriptors.hasOwnProperty(key)) {
            found++;
          } else if (specialKeys.includes(key)) {
            specialInit = true;
          } else {
            throwNoProperty(s, key);
          }
        }
        if (found !== 1) {
          if (found === 0) {
            if (!specialInit && !hasDefaultMember) {
              throwMissingUnionInitializer(s, arg, exclusion);
            }
          } else {
            throwMultipleUnionInitializers(s);
          }
        }
        if (specialInit) {
          for (const key of keys) {
            this[key] = arg[keys];
          }
        } else if (found === 0) {
          if (template) {
            restoreMemory.call(this);
            copy(this[MEMORY], template[MEMORY]);
            if (pointerCopier) {
              pointerCopier.call(this, template);
            }
          }
          if (showDefault) {
            showDefault.call(this);
          }
        } else {
          for (const key of keys) {
            const { init } = descriptors[key];
            init.call(this, arg[key]);
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object with a single property', arg);
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMembers);
  const pointerResetter = s.pointerResetter = getPointerResetter(objectMembers);
  const pointerDisabler = getPointerDisabler(objectMembers);
  if (type === StructureType.TaggedUnion) {
    // enable casting to enum
    Object.defineProperties(constructor.prototype, {
      [ENUM_ITEM]: { get: getEnumItem, configurable: true },
    });
  }
  Object.defineProperties(constructor.prototype, {
    $: { get: retriever, set: initializer, configurable: true },
  });
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s);
  return constructor;
};
