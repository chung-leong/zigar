import { getAccessors } from './member.js';
import { getPrimitiveClass } from './primitive.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addJSONHandlers } from './json.js';
import { throwNoNewEnum } from './error.js';
import { MEMORY, ENUM_INDEX, ENUM_ITEMS, ENUM_ITEM } from './symbol.js';

export function finalizeEnumeration(s) {
  const {
    instance: {
      members,
      template,
    },
    options,
  } = s;
  if (process.env.NODE_DEV !== 'production') {
    /* c8 ignore next 5 */
    for (const member of members) {
      if (member.bitOffset !== undefined) {
        throw new Error(`bitOffset must be undefined for enumeration member`);
      }
    }
  }
  const Primitive = getPrimitiveClass(members[0]);
  const { get: getValue } = getAccessors(members[0], options);
  const count = members.length;
  const items = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum(s);
    }
    if (arg && typeof(arg) === 'object') {
      // if it's a tagged union, return the active tag
      if (arg[ENUM_ITEM]) {
        return arg[ENUM_ITEM];
      }
    }
    let index = -1;
    if (isSequential) {
      // normal enums start at 0 and go up, so the value is the index
      index = Number(arg);
    } else {
      // values aren't sequential, so we need to compare values
      // casting just in case the enum is BigInt
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
  };
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  Object.defineProperties(constructor, {
    [MEMORY]: { value: template[MEMORY] },
    [ENUM_ITEMS]: { value: items },
  });
  const valueOf = function() {
    const index = this[ENUM_INDEX] ;
    return getValue.call(constructor, index);
  };
  Object.defineProperties(constructor.prototype, {
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
  for (const [ index, { name } ] of members.entries()) {
    // can't use the constructor since it would throw
    const item = Object.create(constructor.prototype);
    Object.defineProperties(item, {
      [ENUM_INDEX]: { value: index },
    });
    Object.defineProperties(constructor, {
      [name]: { value: item, configurable: true, enumerable: true, writable: true },
    });
    items[index] = item;
  }
  addStaticMembers(s);
  addMethods(s);
  addJSONHandlers(s);
  return constructor;
};

