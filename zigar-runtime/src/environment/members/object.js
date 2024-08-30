import { mixin } from '../class.js';
import { bindSlot, getObject, getValue, MemberType, setValue } from './all.js';

export default mixin({
  getDescriptorObject(member) {
    const { structure, slot } = member;
    return bindSlot(slot, {
      get: isValueExpected(structure) ? getValue : getObject,
      set: setValue,
    });
  }
});

export function isNeededByMember(member) {
  return member.type === MemberType.Object;
}
