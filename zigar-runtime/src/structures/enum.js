import { StructureFlag } from '../constants.js';
import { } from '../data-view.js';
import { mixin } from '../environment.js';
import { EnumExpected, InvalidInitializer } from '../errors.js';
import { CAST, INITIALIZE, NAME, SLOTS, TAG } from '../symbols.js';
import { defineProperty, defineValue } from '../utils.js';

export default mixin({
  defineEnumeration(structure, descriptors) {
    const {
      instance: {
        members: [ member ],
      },
    } = structure;
    const descriptor = this.defineMember(member);
    const { get, set } = descriptor;
    const propApplier = this.createApplier(structure);
    const expected = [ 'string', 'number', 'tagged union' ];
    const initializer = function(arg) {
      if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidInitializer(structure, expected, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    };
    const constructor = this.createConstructor(structure, {
      onCastError(structure, arg) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    });
    descriptors.$ = descriptor;
    descriptors.toString = this.getValueOfDescriptor?.();
    descriptors[Symbol.toPrimitive] = {
      value(hint)  {
        switch (hint) {
          case 'string':
          case 'default':
            return this.$[NAME];
          default:
            return get.call(this, 'number');
        }
      },
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
  finalizeEnum(structure, descriptors, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    const items = template[SLOTS];
    // obtain getter/setter for accessing int values directly
    const { get, set } = this.defineMember(member, false);
    for (const { name, slot } of members) {
      const item = items[slot];
      // enum can have static variables, so not every member is a enum item
      if (item instanceof constructor) {
        // attach name to item so tagged union code can quickly find it
        defineProperty(item, NAME, defineValue(name));
        const index = get.call(item);
        // make item available by name and by index
        staticDescriptors[name] = staticDescriptors[index] = { value: item };
      }
    }
    // add cast handler allowing strings, numbers, and tagged union to be casted into enums
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg)  === 'string' || typeof(arg) === 'number' || typeof(arg) === 'bigint') {
          let item = constructor[arg];
          if (!item) {
            if (flags & StructureFlag.IsOpenEnded && typeof(arg) !== 'string') {
              // create the item on-the-fly when enum is non-exhaustive
              item = new constructor(undefined);
              // write the value into memory
              set.call(item, arg);
              // attach the new item to the enum set
              defineProperty(item, NAME, defineValue(arg));
              defineProperty(constructor, arg, defineValue(item));
            }
          }
          return item;
        } else if (arg instanceof constructor) {
          return arg;
        } else if (arg?.[TAG] instanceof constructor) {
          // a tagged union, return the active tag
          return arg[TAG];
        } else {
          return false;
        }
      }
    };
  },
  transformDescriptorEnum(int, structure) {
    const findEnum = function(value) {
      const { constructor } = structure;
      // the enumeration constructor returns the object for the int value
      const item = constructor(value);
      if (!item) {
        throw new EnumExpected(structure, value);
      }
      return item
    };
    return {
      get: (int.get.length === 0)
      ? function getEnum() {
          const value = int.get.call(this);
          return findEnum(value);
        }
      : function getEnumElement(index) {
          const value = int.get.call(this, index);
          return findEnum(value);
        },
      set: (int.set.length === 1)
      ? function setEnum(value) {
          const item = findEnum(value);
          // call Symbol.toPrimitive directly as enum can be bigint or number
          value = item[Symbol.toPrimitive]();
          int.set.call(this, value);
        }
      : function setEnumElement(index, value) {
          const item = findEnum(value);
          int.set.call(this, index, item[Symbol.toPrimitive]());
        },
    };
  },
});

