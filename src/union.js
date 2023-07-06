import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { getDataView, addDataViewAccessor } from './data-view.js';
import { addPointerAccessors } from './pointer.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { createChildObjects, getPointerCopier, getPointerResetter } from './struct.js';
import { throwInactiveUnionProperty } from './error.js';
import { MEMORY, ENUM_INDEX, ENUM_ITEM } from './symbol.js';

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
  const descriptors = {};
  let getEnumItem;
  const exclusion = (type === StructureType.BareUnion || type === StructureType.TaggedUnion);
  if (exclusion) {
    const selectorMember = members[members.length - 1];
    let { get: getIndex } = getAccessors(selectorMember, options);
    if (type === StructureType.TaggedUnion) {
      // rely on the enumeration constructor to translate the enum values into indices
      const { structure: { constructor } } = selectorMember;
      getEnumItem = getIndex;
      getIndex = function() {
        const item = getEnumItem.call(this);
        return item[ENUM_INDEX];
      };
    }
    for (const [ index, member ] of members.slice(0, -1).entries()) {
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
      descriptors[member.name] = { get, set, configurable: true, enumerable: true };
    }
  } else {
    // extern union
    for (const member of members) {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, configurable: true, enumerable: true };
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
      [MEMORY]: { value: dv },
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
        const entries = Object.entries(arg);
        if (entries.length > 0) {
          throwMultipleUnionInitializer(structre);
        }
        for (const [ key, value ] of entries) {
          this[key] = value;
        }
      }
    }
  };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMembers);
  const pointerResetter = s.pointerResetter = getPointerResetter(objectMembers);
  if (type === StructureType.TaggedUnion) {
    // enable casting to enum
    Object.defineProperties(constructor.prototype, {
      [ENUM_ITEM]: { get: getEnumItem, configurable: true },
    });
  }
  if (exclusion) {
    addPointerAccessors(s);
  }
  addDataViewAccessor(s);
  addStaticMembers(s);
  addMethods(s);
  return constructor;
};
