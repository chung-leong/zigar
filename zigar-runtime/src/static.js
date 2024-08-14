import { appendEnumeration } from './enumeration.js';
import { appendErrorSet } from './error-set.js';
import { getDescriptor } from './member.js';
import { defineProperties, defineProperty } from './object.js';
import { convertToJSON, getValueOf } from './special.js';
import { getStructEntries, getStructIterator } from './struct.js';
import { ENTRIES_GETTER, PROPS, SLOTS, VARIANT_CREATOR } from './symbol.js';
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
    const { name, slot, structure: { type, instance: { members: [ fnMember ] } } } = member;
    staticDescriptors[name] = getDescriptor(member, env);
    if (type === StructureType.Function) {
      const fn = template[SLOTS][slot];
      // provide a name if one isn't assigned yet
      if (!fn.name) {
        defineProperty(fn, 'name', { value: name });
      }
      // see if it's a getter or setter
      const [ accessorType, propName ] = /^(get|set)\s+([\s\S]+)/.exec(name)?.slice(1) ?? [];
      const argRequired = (accessorType === 'get') ? 0 : 1;
      if (accessorType && fn.length  === argRequired) {
        const descriptor = staticDescriptors[propName] ??= {};
        descriptor[accessorType] = fn;
      }
      // see if it's a method
      if (startsWithSelf(fnMember.structure, structure)) {
        const method = fn[VARIANT_CREATOR]('method');
        if (!method.name) {
          defineProperty(method, 'name', { value: name });
        }
        instanceDescriptors[name] = { get: () => method };
        if (accessorType && method.length  === argRequired) {
          const descriptor = instanceDescriptors[propName] ??= {};
          descriptor[accessorType] = method;
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

function startsWithSelf(argStructure, structure) {
  // get structure of first argument (members[0] is retval)
  const arg0Structure = argStructure.instance.members[1]?.structure;
  if (arg0Structure === structure) {
    return true;
  } else if (arg0Structure?.type === StructureType.SinglePointer) {
    const targetStructure = arg0Structure.instance.members[0].structure;
    if (targetStructure === structure) {
      return true;
    }
  }
  return false;
}
