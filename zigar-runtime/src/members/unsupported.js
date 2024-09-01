import { mixin } from '../environment.js';
import { Unsupported } from '../errors.js';
import { MemberType } from './all.js';

export default mixin({
  getDescriptorUnsupported(member) {
    const throwUnsupported = function() {
      throw new Unsupported();
    };
    return { get: throwUnsupported, set: throwUnsupported };
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Unsupported;
}

