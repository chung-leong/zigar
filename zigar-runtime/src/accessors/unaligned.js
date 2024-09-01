
import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

// handle unaligned ints and floats by copying the bits into a
// temporary buffer, aligning them

export default mixin({
  getAccessorUnaligned(access, member) {
    const { bitSize, bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const byteSize = [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
    const buf = new DataView(new ArrayBuffer(byteSize));
    if (access === 'get') {
      const getAligned = this.getAccessor('get', { ...member, byteSize });
      const copyBits = getBitAlignFunction(bitPos, bitSize, true);
      return function(offset, littleEndian) {
        copyBits(buf, this, offset);
        return getAligned.call(buf, 0, littleEndian);
      };
    } else {
      const setAligned = this.getAccessor('set', { ...member, byteSize });
      const applyBits = getBitAlignFunction(bitPos, bitSize, false);
      return function(offset, value, littleEndian) {
        setAligned.call(buf, 0, value, littleEndian);
        applyBits(this, buf, offset);
      };
    }
  }
});

export function isNeededByMember(member) {
  const { type, bitSize, bitOffset, byteSize } = member;
  if (byteSize === undefined) {
    switch (type) {
      case MemberType.Int:
      case MemberType.Uint:
        if ((bitOffset & 0x07) + bitSize <= 8) {
          break;
        } else {
          // fall-thru
        }
      case MemberType.Float:
        return true;
    }
  }
  return false;
}


export function getBitAlignFunction(bitPos, bitSize, toAligned) {
  if (bitPos + bitSize <= 8) {
    const mask = (2 ** bitSize) - 1;
    if (toAligned) {
      // from single byte
      return function(dest, src, offset) {
        const n = src.getUint8(offset);
        const b = (n >> bitPos) & mask;
        dest.setUint8(0, b);
      };
    } else {
      // to single byte
      const destMask = 0xFF ^ (mask << bitPos);
      return function(dest, src, offset) {
        const n = src.getUint8(0);
        const d = dest.getUint8(offset);
        const b = (d & destMask) | ((n & mask) << bitPos);
        dest.setUint8(offset, b);
      };
    }
  } else {
    const leadBits = 8 - bitPos;
    const leadMask = (2 ** leadBits) - 1;
    if (toAligned) {
      const trailBits = bitSize % 8;
      const trailMask = (2 ** trailBits) - 1;
      return function(dest, src, offset) {
        let i = offset, j = 0;
        let n = src.getUint8(i++), b;
        let bitBuf = (n >> bitPos) & leadMask;
        let bitCount = leadBits;
        let remaining = bitSize;
        do {
          if (remaining > bitCount) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitCount);
            //bitCount += 8;
          }
          b = (remaining >= 8) ? bitBuf & 0xFF : bitBuf & trailMask;
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          //bitCount -= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    } else {
      const trailBits = (bitSize - leadBits) % 8;
      const trailMask = (2 ** trailBits) - 1;
      const destMask1 = 0xFF ^ (leadMask << bitPos);
      const destMask2 = 0xFF ^ trailMask;
      return function(dest, src, offset) {
        let i = 0, j = offset;
        // preserve bits ahead of bitPos
        let d = dest.getUint8(j), n, b;
        let bitBuf = d & destMask1;
        let bitCount = bitPos;
        let remaining = bitSize + bitCount;
        do {
          if (remaining > bitCount) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitCount);
            bitCount += 8;
          }
          if (remaining >= 8) {
            b = bitBuf & 0xFF;
          } else {
            // preserve bits at the destination sitting behind the trailing bits
            d = dest.getUint8(j);
            b = (d & destMask2) | (bitBuf & trailMask);
          }
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          bitCount -= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    }
  }
}
