import { mixin } from '../class.js';
import { MemberType } from './all.js';

export default mixin({
  getDescriptorNull(member) {
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
