import { mixin } from '../class.js';
import { MemberType } from './all.js';

export default mixin({
  getDescriptorFloat(member) {
    return this.getDescriptorUsing(member, this.getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Float;
}
