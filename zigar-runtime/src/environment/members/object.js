import { mixin } from '../class.js';
import { bindSlot, getObject, getValue, MemberType, setValue } from './all.js';

mixin({
  getDescriptorObject(member) {
    const { structure, slot } = member;
    return bindSlot(slot, {
      get: isValueExpected(structure) ? getValue : getObject,
      set: setValue,
    });
  }
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Object;
}
