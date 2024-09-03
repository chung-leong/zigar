import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMemberNull(member) {
    return {
      get: function() {
        return null;
      },
    };
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Null;
}
