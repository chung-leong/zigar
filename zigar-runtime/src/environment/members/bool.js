import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

mixin({
  getDescriptorBool(member, env) {
    const getAccessor = isByteAligned(member) ? this.getAccessorBool : this.getAccessorBoolMisaligned;
    return this.getDescriptorUsing(member, env, getAccessor);
  }
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Bool;
}
