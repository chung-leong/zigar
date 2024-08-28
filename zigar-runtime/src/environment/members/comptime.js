import { mixin } from '../class.js';
import { isValueExpected } from '../structures/all.js';
import { bindSlot, getObject, getValue, MemberType } from './all.js';

mixin({
  getDescriptorComptime(member) {
    const { slot, structure } = member;
    return bindSlot(slot, {
      get: isValueExpected(structure) ? getValue : getObject,
    });
  },
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Comptime;
}

