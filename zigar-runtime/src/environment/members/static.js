import { mixin } from '../class.js';
import { isValueExpected } from '../structures/all.js';
import { bindSlot, getObject, getValue, MemberType } from './all.js';

mixin({
  getDescriptorStatic(member) {
    const { slot, structure } = member;
    return bindSlot(slot, {
      get: isValueExpected(structure) ? getValue : getObject,
      set: setValue,
    });
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Null;
}
