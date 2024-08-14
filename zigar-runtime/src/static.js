import { appendEnumeration } from './enumeration.js';
import { appendErrorSet } from './error-set.js';
import { getDescriptor } from './member.js';
import { defineProperties, defineProperty } from './object.js';
import { convertToJSON, getValueOf } from './special.js';
import { getStructEntries, getStructIterator } from './struct.js';
import { ENTRIES_GETTER, METHOD, PROPS, SLOTS } from './symbol.js';
import { StructureType } from './types.js';

export function addStaticMembers(structure, env) {
  const {
    type,
    constructor,
    static: { members, template },
  } = structure;
  const staticDescriptors = {};
  const instanceDescriptors = {};
  for (const member of members) {
    const { name, slot, structure: { type } } = member;
    staticDescriptors[name] = getDescriptor(member, env);
    if (type === StructureType.Function) {
      const fn = template[SLOTS][slot];
      defineProperty(fn, 'name', { value: name });
      const method = fn[METHOD];
      if (method) {
        instanceDescriptors[name] = { get: () => method };
      }
      // see if it's a getter or setter
      const m = /^(get|set)\s+([\s\S]+)/.exec(name);
      if (m) {
        const type = m[1], propName = m[2];
        const argRequired = (type === 'get') ? 0 : 1;
        // need to match arg count, since instance methods also show up as static methods
        if (method?.length === argRequired) {
          const descriptor = instanceDescriptors[propName] ??= {};
          descriptor[type] = method;
        }
        if (fn.length === argRequired) {
          const descriptor = staticDescriptors[propName] ??= {};
          descriptor[type] = fn;
        }
      }
    }
  }
  defineProperties(constructor, {
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    ...staticDescriptors,
    [Symbol.iterator]: { value: getStructIterator },
    [ENTRIES_GETTER]: { value: getStructEntries },
    // static variables are objects stored in the static template's slots
    [SLOTS]: template && { value: template[SLOTS] },
    // anyerror would have props already
    [PROPS]: !constructor[PROPS] && { value: members.map(m => m.name) },
  });
  defineProperties(constructor.prototype, instanceDescriptors);
  if (type === StructureType.Enum) {
    for (const { name, slot } of members) {
      appendEnumeration(constructor, name, constructor[SLOTS][slot]);
    }
  } else if (type === StructureType.ErrorSet) {
    for (const { name, slot } of members) {
      appendErrorSet(constructor, name, constructor[SLOTS][slot]);
    }
  }
}
