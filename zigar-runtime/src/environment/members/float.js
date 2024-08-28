import { mixin } from '../class.js';
import { MemberType } from './all.js';

mixin({
  getDescriptorFloat(member) {
    return this.getDescriptorUsing(member, this.getAccessor);
  },
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Float;
}
