import { mixin } from '../class.js';
import { bindSlot, MemberType } from './all.js';

mixin({
  getDescriptorLiteral(member) {
    const { slot } = member;
    return bindSlot(slot, { get: getLiteral });
  },
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Literal;
}

function getLiteral(slot) {
  const object = this[SLOTS][slot];
  return object.string;
}
