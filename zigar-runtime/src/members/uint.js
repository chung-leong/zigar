import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMemberUint(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(env, getAccessor);
    }
    return this.defineMemberUsing(member, getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Uint;
}
