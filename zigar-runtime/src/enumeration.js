import { defineProperties } from './structure.js';
import { getDescriptor } from './member.js';
import { getPrimitiveClass } from './primitive.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addSpecialAccessors } from './special.js';
import { throwInvalidInitializer, throwNoNewEnum } from './error.js';
import { ALIGN, ENUM_INDEX, ENUM_NAME, ENUM_ITEMS, ENUM_ITEM, MEMORY, SIZE } from './symbol.js';

export function finalizeEnumeration(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
      template,
    },
  } = s;
  /* DEV-TEST */
  for (const member of members) {
    if (member.bitOffset !== undefined) {
      throw new Error(`bitOffset must be undefined for enumeration member`);
    }
  }
  /* DEV-TEST-END */
  const Primitive = getPrimitiveClass(members[0]);
  const { get: getValue } = getDescriptor(members[0], env);
  const count = members.length;
  const items = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum(s);
    }
    if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      let index = -1;
      if (isSequential) {
        // normal enums start at 0 and go up, so the value is the index
        index = Number(arg);
      } else {
        // values aren't sequential, so we need to compare values
        const given = Primitive(arg);
        for (let i = 0; i < count; i++) {
          const value = getValue.call(constructor, i);
          if (value === given) {
            index = i;
            break;
          }
        }
      }
      // return the enum object (created down below)
      return items[index];
    } else if (arg && typeof(arg) === 'object' && arg[ENUM_ITEM]) {
      // a tagged union, return the active tag
      return arg[ENUM_ITEM];
    } else if (typeof(arg)  === 'string') {
      return constructor[arg];
    } else {
      throwInvalidInitializer(s, [ 'number', 'string', 'tagged union' ], arg);
    }
  };
  const valueOf = function() {
    const index = this[ENUM_INDEX] ;
    return getValue.call(constructor, index);
  };
  defineProperties(constructor.prototype, {
    [Symbol.toPrimitive]: { value: valueOf, configurable: true, writable: true },
    $: { get: valueOf, configurable: true },
  });
  // now that the class has the right hidden properties, getValue() will work
  // scan the array to see if the enum's numeric representation is sequential
  const isSequential = (() => {
    // try-block in the event that the enum has bigInt items
    try {
      for (let i = 0; i < count; i++) {
        if (getValue.call(constructor, i) !== i) {
          return false;
        }
      }
      return true;
      /* c8 ignore next 3 */
    } catch (err) {
      return false;
    }
  })();
  // attach the enum items to the constructor
  const itemDescriptors = {};
  for (const [ index, { name } ] of members.entries()) {
    // can't use the constructor since it would throw
    const item = Object.create(constructor.prototype);
    defineProperties(item, {
      [ENUM_INDEX]: { value: index },
      [ENUM_NAME]: { value: name },
    });
    itemDescriptors[name] = { value: item, configurable: true, enumerable: true, writable: true };
    items[index] = item;
  }
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  defineProperties(constructor, {
    ...itemDescriptors,
    [MEMORY]: { value: template[MEMORY] },
    [ENUM_ITEMS]: { value: items },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s, env);
  addStaticMembers(s, env);
  addMethods(s, env);
  return constructor;
};

