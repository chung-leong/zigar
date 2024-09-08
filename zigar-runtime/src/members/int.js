import { MemberFlag, MemberType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMemberInt(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(getAccessor);
    }
    if (member.flags & MemberFlag.IsSize) {
      getAccessor = this.addSizeAdjustment(getAccessor);
    }
    return this.defineMemberUsing(member, getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Int;
}

