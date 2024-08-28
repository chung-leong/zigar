import { mixin } from '../class.js';

mixin({
  getAccessorBigInt(access, member) {
    const { bitSize, byteSize } = member;
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
    if (bitSize & 0x3f === 0) {
      const wordCount = bitSize >> 6;
      if (access === 'get') {
        return function(offset, littleEndian) {
          let n = 0n;
          if (littleEndian) {
            for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
              const w = this.getBigUint64(j, littleEndian);
              n = (n << 64n) | w;
            }
          } else {
            for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
              const w = this.getBigUint64(j, littleEndian);
              n = (n << 64n) | w;
            }
          }
          return (n & valueMask) - (n & signMask);
        };
      } else {
        return function(offset, value, littleEndian) {
          let n = value;
          const mask = 0xFFFFFFFFFFFFFFFFn;
          if (littleEndian) {
            for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
              const w = n & mask;
              this.setBigUint64(j, w, littleEndian);
              n >>= 64n;
            }
          } else {
            n <<= BigInt(wordCount * 64 - bitSize);
            for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
              const w = n & mask;
              this.setBigUint64(j, w, littleEndian);
              n >>= 64n;
            }
          }
          return n;
        };
      }
    } else {
      const f = this.getAccessor(access, { ...member, bitSize: byteSize * 8 });
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
  },
});
