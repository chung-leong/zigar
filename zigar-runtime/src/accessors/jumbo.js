import { mixin } from '../environment.js';

export default mixin({
  getJumboAccessor(access, bitSize) {
    const wordCount = (bitSize + 63) >> 6;
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
        return n;
      };
    } else {
      return function(offset, value, littleEndian) {
        let n = value;
        const mask = 0xffff_ffff_ffff_ffffn;
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
      };
    }
  }
});
