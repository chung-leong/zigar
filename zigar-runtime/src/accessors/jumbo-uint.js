import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

export default mixin({
  getAccessorJumboUint(access, member) {
    const { bitSize } = member;
    const f = this.getJumboAccessor(access, bitSize);
    const valueMask = (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = f.call(this, offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        f.call(this, offset, n, littleEndian);
      };
    }
  },
});

export function isNeededByMember(member) {
  const { type, bitSize } = member;
  return type === MemberType.Uint && bitSize > 64;
}
