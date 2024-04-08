import {
  throwInactiveUnionProperty, throwInvalidInitializer, throwMissingUnionInitializer,
  throwMultipleUnionInitializers
} from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { copyPointer, disablePointer, never, resetPointer } from './pointer.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getValueOf, handleError } from './special.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { StructureType, attachDescriptors, createConstructor, createPropertyApplier, getSelf } from './structure.js';
import {
  ALIGN, COPIER, NAME, NORMALIZER, POINTER_VISITOR, PROPS, PROP_GETTERS, PROP_SETTERS, SIZE, TAG,
  VIVIFICATOR
} from './symbol.js';

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
      return item[NAME];
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
    const set = (exclusion && setValue) 
    ? function(value) {
        const currentName = getActiveField.call(this);
        if (name !== currentName) {
          throwInactiveUnionProperty(structure, name, currentName);
        }
        setValue.call(this, value);
      }
    : setValue;
    const init = (exclusion && setValue)
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
      this[COPIER](arg);
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
  const modifier = (hasInaccessiblePointer && !env.comptime)
  ? function() {
      // make pointer access throw
      this[POINTER_VISITOR](disablePointer, { vivificate: true });
    }
  : undefined;
  const constructor = structure.constructor = createConstructor(structure, { modifier, initializer }, env);
  const fieldDescriptor = (isTagged)
  ? { 
      // for tagged union,  only the active field
      get() { return [ getActiveField.call(this) ] } 
    }
  : { 
      // for bare and extern union, all members are included 
      value: valueMembers.map(m => m.name)
    };
  const isChildActive = (isTagged)
  ? function(child) {
      const name = getActiveField.call(this);
      const active = memberValueGetters[name].call(this);
      return child === active;
    }
  : never;
  const hasAnyPointer = hasPointer || hasInaccessiblePointer;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer, configurable: true },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    ...memberDescriptors,
    [Symbol.iterator]: { value: getUnionIterator },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [TAG]: isTagged && { get: getSelector, configurable: true },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor(structure, { isChildActive }) },
    [PROP_GETTERS]: { value: memberValueGetters },
    [NORMALIZER]: { value: normalizeUnion },
    [PROPS]: fieldDescriptor,
  };  
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
  // replace regular setters with ones that change the active field
  const setters = constructor.prototype[PROP_SETTERS];
  for (const [ name, init ] of Object.entries(memberInitializers)) {
    if (init) {
      setters[name] = init;
    }
  }
};

export function normalizeUnion(cb, options) {
  const object = {};
  for (const [ name, value ] of getUnionEntries.call(this, options)) {
    object[name] = cb(value);
  }
  return object;
}

export function getUnionEntries(options) {
  return {
    [Symbol.iterator]: getUnionEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

export function getUnionIterator(options) { 
  const entries = getUnionEntries.call(this, options);
  return entries[Symbol.iterator]();
}

export function getUnionEntriesIterator(options) {
  const self = this;
  const props = this[PROPS];
  const getters = this[PROP_GETTERS];
  let index = 0;
  return {
    next() {
      let value, done;      
      if (index < props.length) {
        const current = props[index++];
        // get value of prop with no check
        value = [ current, handleError(() => getters[current].call(self), options) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}