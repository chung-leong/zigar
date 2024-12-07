import { StructureFlag, UnionFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import {
  InaccessiblePointer, InactiveUnionProperty, InvalidInitializer, MissingUnionInitializer,
  MultipleUnionInitializers,
} from '../errors.js';
import { getUnionEntries, getUnionIterator, getZigIterator } from '../iterators.js';
import {
  COPY, DISABLED, ENTRIES, FINALIZE, GETTERS, INITIALIZE, KEYS, NAME, POINTER, PROPS, SETTERS, TAG,
  TARGET, VISIT, VIVIFICATE,
} from '../symbols.js';
import { defineProperties, defineValue, empty } from '../utils.js';

export default mixin({
  defineUnion(structure, descriptors) {
    const {
      flags,
      instance: { members },
    } = structure;
    const exclusion = !!(flags & UnionFlag.HasSelector);
    const valueMembers = (exclusion) ? members.slice(0, -1) : members;
    const selectorMember = (exclusion) ? members[members.length - 1] : null;
    const { get: getSelector, set: setSelector } = this.defineMember(selectorMember);
    const { get: getSelectorNumber } = this.defineMember(selectorMember, false);
    const getActiveField = (flags & UnionFlag.HasTag)
    ? function() {
        const item = getSelector.call(this);
        return item[NAME];
      }
    : function() {
        const index = getSelector.call(this);
        return valueMembers[index].name;
      };
    const setActiveField = (flags & UnionFlag.HasTag)
    ? function(name) {
        const { constructor } = selectorMember.structure;
        setSelector.call(this, constructor[name]);
      }
    : function(name) {
        const index = valueMembers.findIndex(m => m.name === name);
        setSelector.call(this, index);
      };
    const propApplier = this.createApplier(structure);
    const initializer = function(arg, allocator) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else if (arg && typeof(arg) === 'object') {
        let found = 0;
        for (const key of props) {
          if (key in arg) {
            found++;
          }
        }
        if (found > 1) {
          throw new MultipleUnionInitializers(structure);
        }
        if (propApplier.call(this, arg, allocator) === 0) {
          throw new MissingUnionInitializer(structure, arg, exclusion);
        }
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object with a single property', arg);
      }
    };
    const constructor = this.createConstructor(structure);
    const getters = {};
    const setters = descriptors[SETTERS].value;
    const keys = descriptors[KEYS].value;
    const props = [];
    for (const member of valueMembers) {
      const { name } = member;
      const { get: getValue, set: setValue } = this.defineMember(member);
      const get = (exclusion)
      ? function() {
          const currentName = getActiveField.call(this);
          if (name !== currentName) {
            if (flags & UnionFlag.HasTag) {
              // tagged union allows inactive member to be queried
              return null;
            } else {
              // whereas bare union does not, since the condition is not detectable
              // when runtime safety is off
              throw new InactiveUnionProperty(structure, name, currentName);
            }
          }
          this[VISIT]?.('reset');
          return getValue.call(this);
        }
      : getValue;
      const set = (exclusion && setValue)
      ? function(value) {
          const currentName = getActiveField.call(this);
          if (name !== currentName) {
            throw new InactiveUnionProperty(structure, name, currentName);
          }
          setValue.call(this, value);
        }
      : setValue;
      const init = (exclusion && setValue)
      ? function(value) {
          setActiveField.call(this, name);
          setValue.call(this, value);
          this[VISIT]?.('reset');
        }
      : setValue;
      descriptors[name] = { get, set };
      setters[name] = init;
      getters[name] = getValue;
      keys.push(name);
      props.push(name);
    }
    descriptors.$ = { get: function() { return this }, set: initializer };
    descriptors[Symbol.iterator] = {
      value: (flags & UnionFlag.IsIterator) ? getZigIterator : getUnionIterator,
    };
    descriptors[Symbol.toPrimitive] = (flags & UnionFlag.HasTag) && {
      value(hint) {
        switch (hint) {
          case 'string':
          case 'default':
            return getActiveField.call(this);
          default:
            return getSelectorNumber.call(this);
        }
      }
    };
    descriptors[FINALIZE] = (flags & UnionFlag.HasInaccessible) && {
      value() {
        // pointers in non-tagged union are not accessible--we need to disable them
        this[VISIT](disablePointer);
        // no need to visit them again
        this[VISIT] = empty;
        return this;
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[TAG] = (flags & UnionFlag.HasTag) && { get: getSelector, set : setSelector };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] =  (flags & StructureFlag.HasPointer) && this.defineVisitorUnion(valueMembers, (flags & UnionFlag.HasTag) ? getSelectorNumber : null);
    descriptors[ENTRIES] = { get: getUnionEntries };
    descriptors[PROPS] = (flags & UnionFlag.HasTag) ? {
      get() {
        return [ getActiveField.call(this) ];
      }
    } : defineValue(props);
    descriptors[GETTERS] = defineValue(getters);
    return constructor;
  },
  finalizeUnion(structure, staticDescriptors) {
    const {
      flags,
      instance: { members },
    } = structure;
    if (flags & UnionFlag.HasTag) {
      staticDescriptors.tag = defineValue(members[members.length - 1].structure.constructor);
    }
  }
});

function throwInaccessible() {
  throw new InaccessiblePointer();
};

function disablePointer() {
  const disabledProp = { get: throwInaccessible, set: throwInaccessible };
  defineProperties(this[POINTER], {
    '*': disabledProp,
    '$': disabledProp,
    [POINTER]: disabledProp,
    [TARGET]: disabledProp,
    [DISABLED]: defineValue(true),
  });
};
