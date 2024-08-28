import { mixin } from '../class.js';
import { MemberType } from './all.js';

mixin({
  getDescriptorUnsupported(member) {
    const throwUnsupported = function() {
      throw new Unsupported();
    };
    return { get: throwUnsupported, set: throwUnsupported };
  },
});

export function isRequiredByMember(member) {
  return member.type === MemberType.Unsupported;
}

