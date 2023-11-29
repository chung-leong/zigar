import { defineProperties } from './structure.js';
import { getDescriptor } from './member.js';
import { SLOTS, TEMPLATE_SLOTS } from './symbol.js';

export function addStaticMembers(s, env) {
  const {
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
    [TEMPLATE_SLOTS]: template?.[SLOTS] && { value: template[SLOTS] },
  });
}
