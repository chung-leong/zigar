import { mixin } from '../environment.js';

// handle non-standard uints 32-bit or smaller

export default mixin({
  getAccessorUint(access, member) {
    const { bitSize, byteSize } = member;
    if (byteSize) {
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
  }
});

