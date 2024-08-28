import { mixin } from '../class.js';
import { getTypeName } from './all.js';

mixin({
  getAccessorBool1Unaligned(access, member) {
    const { bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const mask = 1 << bitPos;
    if (access === 'get') {
      return function(offset) {
        const n = this.getInt8(offset);
        return !!(n & mask);
      };
    } else {
      return function(offset, value) {
        const n = this.getInt8(this, offset);
        const b = (value) ? n | mask : n & ~mask;
        this.setInt8(offset, b);
      };
    }
  },
});

export function isRequiredByMember(member) {
  return getTypeName(member) === 'Bool1Unaligned';
}
