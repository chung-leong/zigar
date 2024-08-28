import { mixin } from '../class.js';
import { MemberType } from './all.js';

mixin({
  getDescriptorNull(member) {
    return {
      get: function() {
        return null;
      },
    };
  },
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Null;
}
