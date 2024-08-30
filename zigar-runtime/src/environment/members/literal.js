import { SLOTS } from '../../symbol.js';
import { mixin } from '../class.js';
import { bindSlot, MemberType } from './all.js';

export default mixin({
  getDescriptorLiteral(member) {
    const { slot } = member;
    return bindSlot(slot, { get: getLiteral });
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Literal;
}

function getLiteral(slot) {
  const object = this[SLOTS][slot];
  return object.string;
}
