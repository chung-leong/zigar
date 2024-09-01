import { mixin } from '../environment.js';
import { isValueExpected } from '../structures/all.js';
import { bindSlot, getObject, getValue, MemberType } from './all.js';

export default mixin({
  getDescriptorComptime(member) {
    const { slot, structure } = member;
    return bindSlot(slot, {
      get: isValueExpected(structure) ? getValue : getObject,
    });
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Comptime;
}

