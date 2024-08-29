import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

mixin({
  getAccessorBigUint(access, member) {
    const { bitSize, byteSize } = member;
    const valueMask = (2 ** bitSize) - 1;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = this.getBigInt64(offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        this.setBigUint64(offset, n, littleEndian);
      };
    }
  },
});

export function isNeededByMember(member) {
  const { type, bitSize } = member;
  return type === MemberType.Uint && bitSize > 32 && bitSize < 64;
}
