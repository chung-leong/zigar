import { mixin } from '../class.js';
import { MemberType } from './all.js';

mixin({
  getDescriptorUndefined(member) {
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
