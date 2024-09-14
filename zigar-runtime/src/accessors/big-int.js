import { mixin } from '../environment.js';

export default mixin({
  getAccessorBigInt(access, member) {
    const { bitSize } = member;
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = this.getBigUint64(offset, littleEndian);
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
