import { appendEnumeration } from './enumeration.js';
import { appendErrorSet } from './error-set.js';
import { getDescriptor } from './member.js';
import { convertToJSON, getValueOf } from './special.js';
import { getStructIterator, normalizeStruct } from './struct.js';
import { StructureType, defineProperties } from './structure.js';
import { NORMALIZER, PROPS, SLOTS } from './symbol.js';

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
    // static variables are objects stored in the static template's slots
    [SLOTS]: template ? { value: template[SLOTS] } : undefined,
    // anyerror would have props already
    [PROPS]: !constructor[PROPS] ? { value: members.map(m => m.name) } : undefined,
    [NORMALIZER]: { value: normalizeStruct },
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
