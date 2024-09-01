import { mixin } from '../environment.js';
import { SLOTS } from '../symbols.js';
import { bindSlot, MemberType } from './all.js';

export default mixin({
  getDescriptorType(member, env) {
    const { slot } = member;
    return bindSlot(slot, { get: getType });
  }
});

export function isNeededByMember(member) {
  return member.type === MemberType.Type;
}

function getType(slot) {
  // unsupported types will have undefined structure
  const structure = this[SLOTS][slot];
  return structure?.constructor;
}

