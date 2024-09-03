import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMemberFloat(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Float;
}
