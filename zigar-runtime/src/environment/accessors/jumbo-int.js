import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

mixin({
  getAccessorJumboInt(access, member) {
    const { bitSize } = member;
    const f = getJumboAccessor(access, bitSize);
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

export function isNeededByMember(member) {
  const { type, bitSize } = member;
  return type === MemberType.Int && bitSize > 64;
}

export function getJumboAccessor(access, bitSize) {
  const getWord = DataView.prototype.getBigUint64;
  const setWord = DataView.prototype.setBigUint64;
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
