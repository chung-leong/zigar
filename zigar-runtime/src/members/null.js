import { mixin } from '../environment.js';
import { MemberType } from './all.js';

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
