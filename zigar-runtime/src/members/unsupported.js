import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { Unsupported } from '../errors.js';

export default mixin({
  defineMemberUnsupported(member) {
    const throwUnsupported = function() {
      throw new Unsupported();
    };
    return { get: throwUnsupported, set: throwUnsupported };
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Unsupported;
}

