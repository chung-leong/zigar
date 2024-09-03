import { mixin } from '../environment.js';
import { MemberType } from './all.js';

export default mixin({
  defineMemberFloat(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Float;
}
