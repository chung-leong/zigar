import { mixin } from '../class.js';

mixin({
  getAccessorInt(access, member) {
    const { bitSize, byteSize } = member;
    const f = this.getAccessor(access, { ...member, bitSize: byteSize * 8 });
    const signMask = 2 ** (bitSize - 1);
    const valueMask = signMask - 1;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = f.call(this, offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        f.call(this, offset, n, littleEndian);
      };
    }
  }
});
