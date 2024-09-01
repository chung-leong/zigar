import { mixin } from '../environment.js';
import { MemberType } from '../members/all.js';

// handles f80

export default mixin({
  getAccessorFloat80(access, member) {
    const { byteSize } = member;
    const buf = new DataView(new ArrayBuffer(8));
    const get = function(offset, littleEndian) {
      const w1 = BigInt(this.getUint32(offset + (littleEndian ? 0 : byteSize - 4), littleEndian));
      const w2 = BigInt(this.getUint32(offset + (littleEndian ? 4 : byteSize - 8), littleEndian));
      const w3 = BigInt(this.getUint32(offset + (littleEndian ? 8 : byteSize - 12), littleEndian));
      return w1 | w2 << 32n | w3 << 64n;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xffff_ffffn;
      const w2 = (value >> 32n) & 0xffff_ffffn;
      const w3 = (value >> 64n) & 0xffff_ffffn;
      this.setUint32(offset + (littleEndian ? 0 : byteSize - 4), Number(w1), littleEndian);
      this.setUint32(offset + (littleEndian ? 4 : byteSize - 8), Number(w2), littleEndian);
      this.setUint32(offset + (littleEndian ? 8 : byteSize - 12), Number(w3), littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 79n;
        const exp = (n & 0x7fff_0000_0000_0000_0000n) >> 64n;
        const frac = n & 0x0000_7fff_ffff_ffff_ffffn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7fffn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 11n) + BigInt((frac & (2n**11n - 1n)) >= 2n**10n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7ff0_0000_0000_0000n) >> 52n;
        const frac = n & 0x000f_ffff_ffff_ffffn;
        let n80;
        if (exp === 0n) {
          n80 = sign << 79n | (frac << 11n);
        } else if (exp === 0x07ffn) {
          n80 = sign << 79n | 0x7fffn << 64n | (frac ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n;
          //                                                 ^ bit 61                       ^ bit 63
        } else {
          n80 = sign << 79n | (exp - 1023n + 16383n) << 64n | (frac << 11n) | 0x00008000000000000000n;
        }
        set.call(this, offset, n80, littleEndian);
      }
    }
  }
});

export function isNeededByMember(member) {
  const { type, bitSize } = member;
  return type === MemberType.Float && bitSize === 80;
}
