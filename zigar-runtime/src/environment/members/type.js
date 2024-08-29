import { mixin } from '../class.js';
import { bindSlot, MemberType } from './all.js';

mixin({
  getDescriptorType(member, env) {
    const { slot } = member;
    return bindSlot(slot, { get: getType });
  }
});

export function isNeededByMember(member) {
  return member.type === MemberType.Literal;
}

function getType(slot) {
  // unsupported types will have undefined structure
  const structure = this[SLOTS][slot];
  return structure?.constructor;
}

