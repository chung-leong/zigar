import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

// handle non-standard uints 32-bit or smaller

export default mixin({
  getAccessorUint(access, member) {
    const { bitSize, byteSize } = member;
    const f = this.getAccessor(access, { ...member, bitSize: byteSize * 8 });
    const valueMask = (2 ** bitSize) - 1;
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
  }
});

export function isNeededByMember(member) {
  const { type, bitSize, bitOffset, byteSize } = member;
  if (type === MemberType.Uint && bitSize <= 32) {
    if (![ 8, 16, 32 ].includes(bitSize)) {
      if (byteSize === undefined && (bitOffset & 0x07) + bitSize <= 8) {
        // uints handled by the mixin "int-unaligned" don't need this one
        return false;
      }
      return true
    }
  }
  return false;
}
