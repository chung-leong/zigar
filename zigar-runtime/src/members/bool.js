import { mixin } from '../environment.js';
import { MemberType } from './all.js';

export default mixin({
  defineMemberBool(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Bool;
}
