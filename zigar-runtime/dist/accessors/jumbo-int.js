import { mixin } from '../environment.js';

var jumboInt = mixin({
  getAccessorJumboInt(access, member) {
    const { bitSize } = member;
    const f = this.getJumboAccessor(access, bitSize);
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
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
  },
});

export { jumboInt as default };
