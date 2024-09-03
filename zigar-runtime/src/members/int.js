import { mixin } from '../environment.js';
import { MemberType } from './all.js';

export default mixin({
  defineMemberInt(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(env, getAccessor);
    }
    return this.defineMemberUsing(member, getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Int;
}
