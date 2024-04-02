import { getGlobalErrorSet } from './error-set.js';
import { deanimalizeErrorName } from './error.js';
import { getDescriptor } from './member.js';
import { getStructIterator } from './struct.js';
import { StructureType, defineProperties } from './structure.js';
import { ITEMS, MORE, NAME, PROPS, SLOTS } from './symbol.js';

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
    [Symbol.iterator]: { value: getStructIterator },
    // static variables are objects stored in the static template's slots
    [SLOTS]: { value: template[SLOTS] },
    [PROPS]: { value: members.map(m => m.name) },
  });
  if (type === StructureType.Enumeration) {
    const enums = constructor[ITEMS];
    for (const { name, slot } of members) {
      if (name !== undefined) {
        // place item in hash to facilitate lookup, 
        const item = constructor[SLOTS][slot];
        if (item instanceof constructor) {
          // attach name to item so tagged union code can quickly find it
          defineProperties(item, { [NAME]: { value: name } });  
          const index = item[Symbol.toPrimitive]();
          enums[index] = enums[name] = item;          
        }      
      } else {
        // non-exhaustive enum
        defineProperties(constructor, { [MORE]: { value: true } });
      }
    }
  } else if (type === StructureType.ErrorSet) {
    const allErrors = getGlobalErrorSet();
    const errors = constructor[ITEMS];
    for (const { name, slot } of members) {
      let error = constructor[SLOTS][slot];
      const index = Number(error);
      const previous = allErrors[index];
      if (previous) {
        if (!(previous instanceof constructor)) {
          // error already exists in a previously defined set
          // see if we should make that set a subclass or superclass of this one
          const otherSet = previous.constructor;
          const otherErrors = Object.values(otherSet[SLOTS]);
          const errorIndices = Object.values(constructor[SLOTS]).map(e => Number(e));
          if (otherErrors.every(e => errorIndices.includes(Number(e)))) {
            // this set contains the all errors of the other one, so it's a superclass
            Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
          } else {
            // make this set a subclass of the other
            Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
            for (const otherError of otherErrors) {
              if (errorIndices.includes(Number(otherError))) {
                // this set should be this error object's class
                Object.setPrototypeOf(otherError, constructor.prototype);
              }
            }
          }
        }
        error = constructor[SLOTS][slot] = previous;       
      } else {
        // set error message (overriding prototype) and add to hash
        defineProperties(error, { message: { value: deanimalizeErrorName(name) } });
        allErrors[index] = allErrors[error.message] = allErrors[`${error}`] = error;
      }
      errors[index] = errors[error.message] = errors[`${error}`] = error;
    }
  }
}
