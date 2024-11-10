import { MemberFlag, EnumFlag, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidInitializer, EnumExpected } from '../errors.js';
import { NAME, INITIALIZE, SLOTS, CAST, TAG, TYPED_ARRAY } from '../symbols.js';
import { defineValue, toString, defineProperty } from '../utils.js';

var _enum = mixin({
  defineEnum(structure, descriptors) {
    const {
      instance: {
        members: [ member ],
      },
    } = structure;
    const descriptor = this.defineMember(member);
    const { get, set } = descriptor;
    const { get: getNumber } = this.defineMember(member, false);
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
    descriptors.toString = defineValue(toString);
    descriptors[Symbol.toPrimitive] = {
      value(hint)  {
        switch (hint) {
          case 'string':
          case 'default':
            return this.$[NAME];
          default:
            return getNumber.call(this);
        }
      },
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
  finalizeEnum(structure, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    const items = template[SLOTS];
    // obtain getter/setter for accessing int values directly
    const { get, set } = this.defineMember(member, false);
    for (const { name, flags, slot } of members) {
      if (flags & MemberFlag.IsPartOfSet) {
        const item = items[slot];
        // attach name to item so tagged union code can quickly find it
        defineProperty(item, NAME, defineValue(name));
        const index = get.call(item);
        // make item available by name and by index
        staticDescriptors[name] = staticDescriptors[index] = { value: item, writable: false };
      }
    }
    // add cast handler allowing strings, numbers, and tagged union to be casted into enums
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg)  === 'string' || typeof(arg) === 'number' || typeof(arg) === 'bigint') {
          let item = constructor[arg];
          if (!item) {
            if (flags & EnumFlag.IsOpenEnded && typeof(arg) !== 'string') {
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
    staticDescriptors[TYPED_ARRAY] = defineValue(this.getTypedArray(structure));
  },
  transformDescriptorEnum(descriptor, member) {
    const { type, structure } = member;
    if (type === MemberType.Object) {
      return descriptor;
    }
    const findEnum = function(value) {
      const { constructor } = structure;
      // the enumeration constructor returns the object for the int value
      const item = constructor(value);
      if (!item) {
        throw new EnumExpected(structure, value);
      }
      return item
    };
    const { get, set } = descriptor;
    return {
      get: (get.length === 0)
      ? function getEnum() {
          const value = get.call(this);
          return findEnum(value);
        }
      : function getEnumElement(index) {
          const value = get.call(this, index);
          return findEnum(value);
        },
      set: (set.length === 1)
      ? function setEnum(value) {
          const item = findEnum(value);
          // call Symbol.toPrimitive directly as enum can be bigint or number
          value = item[Symbol.toPrimitive]();
          set.call(this, value);
        }
      : function setEnumElement(index, value) {
          const item = findEnum(value);
          set.call(this, index, item[Symbol.toPrimitive]());
        },
    };
  },
});

export { _enum as default };
