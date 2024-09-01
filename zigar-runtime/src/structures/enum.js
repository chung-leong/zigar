import { } from '../data-view.js';
import { defineProperties, mixin } from '../environment.js';
import { EnumExpected, InvalidInitializer } from '../errors.js';
import { MORE, NAME, TAG } from '../symbols.js';
import { getTypedArrayClass } from './all.js';

export default mixin({
  defineEnumeration(structure) {
    const {
      byteSize,
      align,
      instance: {
        members: [ member ],
      },
    } = structure;
    const thisEnv = this;
    const { get, set } = this.getDescriptor(member);
    const expected = [ 'string', 'number', 'tagged union' ];
    const propApplier = this.createPropertyApplier(structure);
    const initializer = function(arg) {
      if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidInitializer(structure, expected, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    };
    const alternateCaster = function(arg) {
      if (typeof(arg)  === 'string' || typeof(arg) === 'number' || typeof(arg) === 'bigint') {
        let item = constructor[arg];
        if (!item) {
          if (constructor[MORE] && typeof(arg) !== 'string') {
            // create the item on-the-fly when enum is non-exhaustive
            item = new constructor(undefined);
            set.call(item, arg, 'number');
            appendEnumeration(constructor, `${arg}`, item);
          }
        }
        return item;
      } else if (arg instanceof constructor) {
        return arg;
      } else if (arg?.[TAG] instanceof constructor) {
        // a tagged union, return the active tag
        return arg[TAG];
      } else if (!thisEnv.getDataView(structure, arg)) {
        throw new InvalidInitializer(structure, expected, arg);
      } else {
        return false;
      }
    };
    const constructor = structure.constructor = this.createConstructor(structure, { initializer, alternateCaster });
    const typedArray = structure.typedArray = getTypedArrayClass(member);
    const toPrimitive = function(hint) {
      switch (hint) {
        case 'string':
        case 'default':
          return this.$[NAME];
        default:
          return get.call(this, 'number');
      }
    };
    const instanceDescriptors = {
      $: { get, set },
      toString: this.getValueOfDescriptor?.(),
      [Symbol.toPrimitive]: { value: toPrimitive },
    };
    const staticDescriptors = {};
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  },
  transformEnumerationDescriptor(int, structure) {
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
      ? function getEnum(hint) {
          const value = int.get.call(this);
          if (hint === 'number') {
            return value;
          }
          return findEnum(value);
        }
      : function getEnumElement(index) {
          const value = int.get.call(this, index);
          return findEnum(value);
        },
      set: (int.set.length === 1)
      ? function setEnum(value, hint) {
          if (hint !== 'number') {
            const item = findEnum(value);
            // call Symbol.toPrimitive directly as enum can be bigint or number
            value = item[Symbol.toPrimitive]();
          }
          int.set.call(this, value);
        }
      : function setEnumElement(index, value) {
          const item = findEnum(value);
          int.set.call(this, index, item[Symbol.toPrimitive]());
        },
    };
  },
});

export function appendEnumeration(enumeration, name, item) {
  if (name !== undefined) {
    // enum can have static variables
    if (item instanceof enumeration) {
      // attach name to item so tagged union code can quickly find it
      defineProperties(item, { [NAME]: { value: name } });
      // call toPrimitive directly since enum can be bigint or number
      const index = item[Symbol.toPrimitive]();
      defineProperties(enumeration, {
        [index]: { value: item },
        [name]: { value: item },
      });
    }
  } else {
    // non-exhaustive enum
    defineProperties(enumeration, { [MORE]: { value: true } });
  }
}