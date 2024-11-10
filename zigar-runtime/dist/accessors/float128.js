import { mixin } from '../environment.js';

// handles f128

var float128 = mixin({
  getAccessorFloat128(access, member) {
    const { byteSize } = member;
    const buf = new DataView(new ArrayBuffer(8));
    const get = function(offset, littleEndian) {
      const w1 = BigInt(this.getUint32(offset + (littleEndian ? 0 : byteSize - 4), littleEndian));
      const w2 = BigInt(this.getUint32(offset + (littleEndian ? 4 : byteSize - 8), littleEndian));
      const w3 = BigInt(this.getUint32(offset + (littleEndian ? 8 : byteSize - 12), littleEndian));
      const w4 = BigInt(this.getUint32(offset + (littleEndian ? 12 : byteSize - 16), littleEndian));
      return w1 | w2 << 32n | w3 << 64n | w4 << 96n;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xffff_ffffn;
      const w2 = (value >> 32n) & 0xffff_ffffn;
      const w3 = (value >> 64n) & 0xffff_ffffn;
      const w4 = (value >> 96n) & 0xffff_ffffn;
      this.setUint32(offset + (littleEndian ? 0 : byteSize - 4), Number(w1), littleEndian);
      this.setUint32(offset + (littleEndian ? 4 : byteSize - 8), Number(w2), littleEndian);
      this.setUint32(offset + (littleEndian ? 8 : byteSize - 12), Number(w3), littleEndian);
      this.setUint32(offset + (littleEndian ? 12 : byteSize - 16), Number(w4), littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 127n;
        const exp = (n & 0x7fff_0000_0000_0000_0000_0000_0000_0000n) >> 112n;
        const frac = n & 0x0000_ffff_ffff_ffff_ffff_ffff_ffff_ffffn;
        if (exp === 0n) {
          const value = (frac) ? Number.MIN_VALUE : 0;
          return (sign) ? -value : value;
        } else if (exp === 0x7fffn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          const value = Infinity;
          return (sign) ? -value : value;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 60n) + BigInt((frac & (2n**60n - 1n)) >= 2n**59n);
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
        let n128;
        if (exp === 0n) {
          n128 = sign << 127n | (frac << 60n);
        } else if (exp === 0x07ffn) {
          n128 = sign << 127n | 0x7fffn << 112n | (frac ? 1n : 0n);
        } else {
          n128 = sign << 127n | (exp - 1023n + 16383n) << 112n | (frac << 60n);
        }
        set.call(this, offset, n128, littleEndian);
      }
    }
  }
});

export { float128 as default };
