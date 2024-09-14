import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import {
  InactiveUnionProperty, InvalidInitializer, MissingUnionInitializer, MultipleUnionInitializers
} from '../errors.js';
import { getUnionEntries, getUnionIterator, getZigIterator } from '../iterators.js';
import {
  COPY, ENTRIES, GETTERS, INITIALIZE, KEYS, MODIFY, NAME, PROPS, SETTERS, TAG, VISIT, VIVIFICATE
} from '../symbols.js';
import { defineValue } from '../utils.js';

export default mixin({
  defineUnion(structure, descriptors) {
    const {
      flags,
      instance: { members },
    } = structure;
    const exclusion = !!(flags & StructureFlag.HasSelector);
    const valueMembers = (exclusion) ? members.slice(0, -1) : members;
    const selectorMember = (exclusion) ? members[members.length - 1] : null;
    const { get: getSelector, set: setSelector } = this.defineMember(selectorMember);
    const { get: getSelectorNumber } = this.defineMember(selectorMember, false);
    const getActiveField = (flags & StructureFlag.HasTag)
    ? function() {
        const item = getSelector.call(this);
        return item[NAME];
      }
    : function() {
        const index = getSelector.call(this);
        return valueMembers[index].name;
      };
    const setActiveField = (flags & StructureFlag.HasTag)
    ? function(name) {
        const { constructor } = selectorMember.structure;
        setSelector.call(this, constructor[name]);
      }
    : function(name) {
        const index = valueMembers.findIndex(m => m.name === name);
        setSelector.call(this, index);
      };
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
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
        if (propApplier.call(this, arg) === 0) {
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
            if (flags & StructureFlag.HasTag) {
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
      value: (flags & StructureFlag.IsIterator) ? getZigIterator : getUnionIterator,
    };
    descriptors[Symbol.toPrimitive] = (flags & StructureFlag.HasTag) && {
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
    descriptors[MODIFY] = (flags & StructureFlag.HasInaccessible && !this.comptime) && {
      value() {
        // pointers in non-tagged union are not accessible--we need to disable them
        this[VISIT]('disable', { vivificate: true });
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[TAG] = (flags & StructureFlag.HasTag) && { get: getSelector, set : setSelector };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] =  (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, {
      isChildActive: (flags & StructureFlag.HasTag)
      ? function(child) {
          const name = getActiveField.call(this);
          const active = getters[name].call(this);
          return child === active;
        }
      : () => false,
    });
    descriptors[ENTRIES] = { get: getUnionEntries };
    descriptors[PROPS] = (flags & StructureFlag.HasTag) ? {
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
    if (flags & StructureFlag.HasTag) {
      staticDescriptors.tag = defineValue(members[members.length - 1].structure.constructor);
    }
  }
});
