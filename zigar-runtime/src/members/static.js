import { mixin } from '../environment.js';
import { isValueExpected } from '../structures/all.js';
import { bindSlot, getObject, getValue, MemberType, setValue } from './all.js';

export default mixin({
  getDescriptorStatic(member) {
    const { slot, structure } = member;
    return bindSlot(slot, {
      get: isValueExpected(structure) ? getValue : getObject,
      set: setValue,
    });
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Static;
}