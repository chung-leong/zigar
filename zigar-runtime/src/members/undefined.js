import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMemberUndefined(member) {
    return {
      get: function() {
        return undefined;
      },
    };
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Undefined;
}
