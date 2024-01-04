import { StructureType, attachDescriptors, createConstructor, createPropertyApplier, getSelf } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getBase64Accessors, getDataViewAccessors, getValueOf } from './special.js';
import { getChildVivificator, getPointerVisitor, normalizeStruct } from './struct.js';
import { throwInvalidInitializer, throwMissingUnionInitializer, throwMultipleUnionInitializers,
  throwInactiveUnionProperty } from './error.js';
import { always, copyPointer, disablePointer, resetPointer } from './pointer.js';
import { ALIGN, CHILD_VIVIFICATOR, ENUM_ITEM, ENUM_NAME, MEMORY_COPIER, POINTER_VISITOR, SETTERS, 
  SIZE, VALUE_NORMALIZER } from './symbol.js';

export function defineUnionShape(structure, env) {
  const {
    type,
    byteSize,
    align,
    instance: { members, template },
    hasPointer,
  } = structure;
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
            throwInactiveUnionProperty(structure, name, currentName);
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
          throwInactiveUnionProperty(structure, name, currentName);
        }
        setValue.call(this, value);
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
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const memberKeys = Object.keys(memberDescriptors);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY-END */
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else if (arg && typeof(arg) === 'object') {
      let found = 0;
      for (const key of memberKeys) {
        if (key in arg) {
          found++;
        }
      }
      if (found > 1) {
        throwMultipleUnionInitializers(structure);
      }
      if (propApplier.call(this, arg) === 0 && !hasDefaultMember) {
        throwMissingUnionInitializer(structure, arg, exclusion);
      }
    } else if (arg !== undefined) {
      throwInvalidInitializer(structure, 'object with a single property', arg);
    }
  };
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
  const modifier = (hasInaccessiblePointer) 
  ? function() {
      // make pointer access throw
      this[POINTER_VISITOR](disablePointer, { vivificate: true });
    }
  : undefined;
  const constructor = structure.constructor = createConstructor(structure, { modifier, initializer }, env);
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
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer, configurable: true },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    ...memberDescriptors,
    [Symbol.iterator]: { value: interatorCreator },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [ENUM_ITEM]: isTagged && { get: getSelector, configurable: true },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor(structure, { isChildActive }) },
    [VALUE_NORMALIZER]: { value: normalizeStruct },
  };  
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
  // replace regular setters with ones that change the active field
  const setters = constructor.prototype[SETTERS];
  for (const [ name, init ] of Object.entries(memberInitializers)) {
    setters[name] = init;
  }
};
