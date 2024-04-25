import { appendEnumeration } from './enumeration.js';
import { appendErrorSet } from './error-set.js';
import { getDescriptor } from './member.js';
import { defineProperties } from './object.js';
import { convertToJSON, getValueOf } from './special.js';
import { getStructEntries, getStructIterator } from './struct.js';
import { ENTRIES_GETTER, PROPS, SLOTS } from './symbol.js';
import { StructureType } from './types.js';

export function addStaticMembers(structure, env) {
  const {
    type,
    constructor,
    static: { members, template },
  } = structure;
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getDescriptor(member, env);
  }
  defineProperties(constructor, {
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    ...descriptors,
    [Symbol.iterator]: { value: getStructIterator },
    [ENTRIES_GETTER]: { value: getStructEntries },
    // static variables are objects stored in the static template's slots
    [SLOTS]: template && { value: template[SLOTS] },
    // anyerror would have props already
    [PROPS]: !constructor[PROPS] && { value: members.map(m => m.name) },
  });
  if (type === StructureType.Enumeration) {
    for (const { name, slot } of members) {
      appendEnumeration(constructor, name, constructor[SLOTS][slot]);
    }
  } else if (type === StructureType.ErrorSet) {
    for (const { name, slot } of members) {
      appendErrorSet(constructor, name, constructor[SLOTS][slot]);
    }
  }
}
