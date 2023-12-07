import { StructureType, defineProperties } from './structure.js';
import { getDescriptor } from './member.js';
import { ENUM_ITEMS, ENUM_NAME, SLOTS } from './symbol.js';

export function addStaticMembers(s, env) {
  const {
    type,
    constructor,
    static: {
      members,
      template,
    },
  } = s;
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getDescriptor(member, env);
  }
  defineProperties(constructor, {
    ...descriptors,
    // static variables are objects stored in the static template's slots
    [SLOTS]: template?.[SLOTS] && { value: template[SLOTS] },
  });  
  if (type === StructureType.Enumeration) {
    const byIndex = constructor[ENUM_ITEMS];
    for (const { name } of members) {
      // place item in hash to facilitate lookup
      const item = constructor[name];
      const index = item.valueOf();
      byIndex[index] = item;
      // attach name to item so tagged union code can quickly find it
      defineProperties(item, { [ENUM_NAME]: { value: name } });
    }
  }
}
