import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { addPointerAccessors } from './pointer.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addJSONHandlers } from './json.js';
import { createChildObjects, getPointerCopier, getPointerResetter } from './struct.js';
import {
  throwInvalidInitializer,
  throwMissingUnionInitializer,
  throwMultipleUnionInitializers,
  throwNoProperty,
  throwInactiveUnionProperty,
} from './error.js';
import { MEMORY, ENUM_INDEX, ENUM_ITEM, HIDE_PREVIOUS } from './symbol.js';

export function finalizeUnion(s) {
  const {
    type,
    size,
    instance: {
      members,
      template,
    },
    options,
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
    let { get: getIndex, set: setIndex } = getAccessors(selectorMember, options);
    if (type === StructureType.TaggedUnion) {
      // rely on the enumeration constructor to translate the enum values into indices
      const { structure: { constructor } } = selectorMember;
      getEnumItem = getIndex;
      getIndex = function() {
        const item = getEnumItem.call(this);
        return item[ENUM_INDEX];
      };
    }
    showDefault = function() {
      const index = getIndex.call(this);
      const { name } = members[index];
      Object.defineProperty(this, name, { enumerable: true });
    };
    valueMembers = members.slice(0, -1);
    for (const [ index, member ] of valueMembers.entries()) {
      const { get: getValue, set: setValue } = getAccessors(member, options);
      const get = function() {
        if (index !== getIndex.call(this)) {
          return null;
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
        const { name } = member;
        const hide = () => Object.defineProperty(this, name, { enumerable: false });
        Object.defineProperties(this, {
          [name]: { enumerable: true },
          [HIDE_PREVIOUS]: { value: hide, configurable: true },
        });
      };
      const init = function(value) {
        this[HIDE_PREVIOUS]?.call();
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
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation--expect an object
      // TODO: validate argument
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
    });
    Object.defineProperties(self, descriptors);
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const copy = getMemoryCopier(size);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (arg && typeof(arg) !== 'object') {
        throwInvalidInitializer(s, 'an object with a single property', arg);
      }
      const keys = (arg) ? Object.keys(arg) : [];
      for (const key of keys) {
        if (!descriptors.hasOwnProperty(key)) {
          throwNoProperty(s, key);
        }
      }
      if (keys.length !== 1) {
        if (keys.length === 0) {
          if (!hasDefaultMember) {
            throwMissingUnionInitializer(s);
          }
        } else {
          throwMultipleUnionInitializers(s);
        }
      }
      if (keys.length === 0) {
        if (template) {
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
          init.call(this, arg[keys]);
        }
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMembers);
  const pointerResetter = s.pointerResetter = getPointerResetter(objectMembers);
  if (type === StructureType.TaggedUnion) {
    // enable casting to enum
    Object.defineProperties(constructor.prototype, {
      [ENUM_ITEM]: { get: getEnumItem, configurable: true },
    });
  }
  Object.defineProperties(constructor.prototype, {
    $: { get: retriever, set: initializer, configurable: true },
  });
  if (exclusion) {
    addPointerAccessors(s);
  }
  addDataViewAccessor(s);
  addStaticMembers(s);
  addMethods(s);
  addJSONHandlers(s);
  return constructor;
};
