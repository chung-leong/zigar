import { StructureType, defineProperties } from './structure.js';
import { getDescriptor } from './member.js';
import { decamelizeErrorName } from './error.js';
import { getCurrentErrorSets } from './error-set.js';
import { ENUM_ITEMS, ENUM_NAME, ERROR_ITEMS, ERROR_MESSAGES, SLOTS } from './symbol.js';

export function addStaticMembers(structure, env) {
  const {
    type,
    constructor,
    static: { members, template },
  } = structure;
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
    for (const { name, slot } of members) {
      // place item in hash to facilitate lookup, 
      const item = constructor[SLOTS][slot];
      if (item instanceof constructor) {
        const index = item[Symbol.toPrimitive]();
        byIndex[index] = item;
        // attach name to item so tagged union code can quickly find it
        defineProperties(item, { [ENUM_NAME]: { value: name } });  
      }      
    }
  } else if (type === StructureType.ErrorSet) {
    const currentErrorSets = getCurrentErrorSets();
    const byIndex = constructor[ERROR_ITEMS];
    const messages = constructor[ERROR_MESSAGES];
    for (const { name, slot } of members) {
      let error = constructor[SLOTS][slot];
      const { index } = error;
      const previous = currentErrorSets[index];
      if (previous) {
        if (!(previous instanceof constructor)) {
          // error already exists in a previously defined set
          // see if we should make that set a subclass or superclass of this one
          const otherSet = previous.constructor;
          const otherErrors = Object.values(otherSet[SLOTS]);
          const errorIndices = Object.values(constructor[SLOTS]).map(e => e.index);
          if (otherErrors.every(e => errorIndices.includes(e.index))) {
            // this set contains the all errors of the other one, so it's a superclass
            Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
          } else {
            // make this set a subclass of the other
            Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
            for (const otherError of otherErrors) {
              if (errorIndices.includes(otherError.index)) {
                // this set should be this error object's class
                Object.setPrototypeOf(otherError, constructor.prototype);
              }
            }
          }
        }
        error = constructor[SLOTS][slot] = previous;       
      } else {
        // set error message
        messages[error.index] = decamelizeErrorName(name);
        currentErrorSets[index] = error;
      }
      byIndex[index] = error;
    }
  }
}
