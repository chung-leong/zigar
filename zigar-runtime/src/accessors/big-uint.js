import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  getAccessorBigUint(access, member) {
    const { bitSize } = member;
    const valueMask = (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = this.getBigInt64(offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        this.setBigUint64(offset, n, littleEndian);
      };
    }
  },
});

export function isNeededByMember(member) {
  const { type, bitSize } = member;
  return type === MemberType.Uint && bitSize > 32 && bitSize < 64;
}
