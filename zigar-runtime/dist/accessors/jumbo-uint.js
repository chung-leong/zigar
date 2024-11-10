import { mixin } from '../environment.js';

var jumboUint = mixin({
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

export { jumboUint as default };
