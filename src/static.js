import { getAccessors } from './member.js';
import { SLOTS } from './symbol.js';

export function addStaticMembers(s) {
  const {
    constructor,
    static: {
      members,
      template,
    },
    options,
  } = s;
  const descriptors = {
    [SLOTS]: { value: template?.[SLOTS] },
  };
  for (const member of members) {
    const { get, set } = getAccessors(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  };
  Object.defineProperties(constructor, descriptors);
}
