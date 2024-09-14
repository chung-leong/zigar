import { mixin } from '../environment.js';

// handle ints 7-bit or smaller in packed structs that are stored in a single byte
// other unaligned ints are handled by the mixin "unaligned"

export default mixin({
  getAccessorIntUnaligned(access, member) {
    const { bitSize, bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    if (bitPos + bitSize <= 8) {
      const signMask = 2 ** (bitSize - 1);
      const valueMask = signMask - 1;
      if (access === 'get') {
        return function(offset) {
          const n = this.getUint8(offset);
          const s = n >>> bitPos;
          return (s & valueMask) - (s & signMask);
        };
      } else {
        const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
        return function(offset, value) {
          let b = this.getUint8(offset);
          const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
          b = (b & outsideMask) | (n << bitPos);
          this.setUint8(offset, b);
        };
      }
    }
  }
});

