import { StructureType, defineProperties } from './structure.js';
import { getDescriptor } from './member.js';
import { decamelizeErrorName } from './error.js';
import { ENUM_ITEMS, ENUM_NAME, ERROR_ITEMS, SLOTS } from './symbol.js';

export function addStaticMembers(s, env) {
  const {
    type,
    constructor,
    static: {
      members,
      template,
    },
  } = s;
  if (members.length === 0) {
    return;
  }
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getDescriptor(member, env);
  }
  defineProperties(constructor, {
    ...descriptors,
    // static variables are objects stored in the static template's slots
    [SLOTS]: { value: template[SLOTS] },
  });
  if (type === StructureType.Enumeration) {
    const byIndex = constructor[ENUM_ITEMS];
    for (const { name } of members) {
      // place item in hash to facilitate lookup
      const item = constructor[name];      
      if (item instanceof constructor) {
        const index = item[Symbol.toPrimitive]();
        byIndex[index] = item;
        // attach name to item so tagged union code can quickly find it
        defineProperties(item, { [ENUM_NAME]: { value: name } });  
      }
    }
  } else if (type === StructureType.ErrorSet) {
    const byIndex = constructor[ERROR_ITEMS];
    for (const { name } of members) {
      const item = constructor[name];
      const index = item.index;
      byIndex[index] = item;
      if (Object.getPrototypeOf(item) === constructor.prototype) {
        // add message to error object
        const message = decamelizeErrorName(name);
        defineProperties(item, {
          message: { value: message, configurable: true, enumerable: true, writable: false },
        });      
      } else if (!(item instanceof constructor)) {
        // error already exists in a previously defined set
        // see if we should make that set a subclass or superclass of this one
        const otherSet = item.constructor;
        const otherErrors = Object.values(otherSet);
        const theseErrors = Object.values(constructor);
        if (otherErrors.every(e => theseErrors.includes(e))) {
          // this set contains the all errors of the other one, so it's a superclass
          Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
        } else {
          // make this set a subclass of the other
          Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
          for (const otherError of otherErrors) {
            if (theseErrors.includes(otherError)) {
              // this set should be this error object's class
              Object.setPrototypeOf(otherError, constructor.prototype);
            }
          }
        }
      }
    }
  }
}
