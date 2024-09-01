import { mixin } from '../environment.js';
import { MemberType } from '../members/all.js';

// handle uints 7-bit or smaller in packed structs that are stored in a single byte
// other unaligned ints are handled by the mixin "unaligned"

export default mixin({
  getAccessorUintUnaligned(access, member) {
    const { bitSize, bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    if (bitPos + bitSize <= 8) {
      const valueMask = (2 ** bitSize - 1);
      if (access === 'get') {
        return function(offset) {
          const n = this.getUint8(offset);
          const s = n >>> bitPos;
          return s & valueMask;
        };
      } else {
        const outsideMask = 0xFF ^ (valueMask << bitPos);
        return function(offset, value) {
          const n = this.getUint8(offset);
          const b = (n & outsideMask) | ((value & valueMask) << bitPos);
          this.setUint8(offset, b);
        };
      }
    }
  },
});

export function isNeededByMember(member) {
  const { type, bitSize, bitOffset, byteSize } = member;
  return type === MemberType.Uint && byteSize === undefined && (bitOffset & 0x07) + bitSize <= 8;
}