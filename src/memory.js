export function obtainBitAlignFunction(bitPos, bits, toAligned) {
  if (bitPos + bits <= 8) {
    const mask = ((2 ** bits) - 1) << bitPos;
    if (toAligned) {
      // from single byte
      return function(dest, src, offset) {
        const n = src.getUint8(offset);
        const b = (n & mask) >> bitPos;
        dest.setUint8(0, b);
      };
    } else {
      // to single byte
      return function(dest, src, offset) {
        const n = src.getUint8(0);
        const d = dest.getUint8(offset);
        const b = (d & (0xFF ^ mask)) | ((n << bitPos) & mask);
        dest.setUint8(offset, b);
      };
    }
  } else if (bitPos + bits <= 16) {
    const leadBits = 8 - bitPos;
    const leadMask = ((2 ** leadBits) - 1) << bitPos;
    const trailBits = bits - leadBits;
    const trailMask = (2 ** trailBits) - 1; 
    if (toAligned) {
      // from two bytes
      if (bits <= 8) {
        // to one byte
        return function(dest, src, offset) {
          const n1 = src.getUint8(offset);
          const n2 = src.getUint8(offset + 1);
          const b = ((n1 & leadMask) >> bitPos) | ((n2 & trailMask) << leadBits);
          dest.setUint8(0, b);
        }; 
      } else {
        // to two bytes
        return function(dest, src, offset) {
          const n1 = src.getUint8(offset);
          const n2 = src.getUint8(offset + 1);
          const b1 = ((n1 & leadMask) >> bitPos) | ((n2 << leadBits) & 0xFF);
          const b2 = n2 & trailMask;
          dest.setUint8(0, b1);
          dest.setUint8(1, b2);
        };
      }
    } else {
      // to two bytes
      if (bits <= 8) {
        // from one byte
        return function(dest, src, offset) {
          const n = src.getUint8(0);
          const d1 = dest.getUint8(offset);
          const d2 = dest.getUint8(offset + 1);
          const b1 = (d1 & (0xFF ^ leadMask)) | ((n << bitPos) & leadMask);
          const b2 = (d2 & (0xFF ^ trailMask)) | ((n >> leadBits) & trailMask);
          dest.setUint8(offset, b1);
          dest.setUint8(offset + 1, b2);
        }; 
      } else {
        // from two bytes
        return function(dest, src, offset) {
          const n1 = src.getUint8(0);
          const n2 = src.getUint8(1);
          const d1 = dest.getUint8(offset);
          const d2 = dest.getUint8(offset + 1);
          const b1 = (d1 & (0xFF ^ leadMask)) | ((n1 << bitPos) & leadMask);
          const b2 = (d2 & (0xFF ^ trailMask)) | ((n1 >> leadBits) & 0xFF) | (n2 & trailMask);
          dest.setUint8(offset, b1);
          dest.setUint8(offset + 1, b2);
        }; 
      }
    }
  } else {
    const leadBits = 8 - bitPos;
    const leadMask = ((2 ** leadBits) - 1) << bitPos;
    if (toAligned) {
      const trailBits = bits % 8;
      const trailMask = (2 ** trailBits) - 1;  
      return function(dest, src, offset) {
        let i = offset, j = 0;
        let n = src.getUint8(i++), b;
        let bitBuf = n >> bitPos; 
        let remaining = bits;
        do {
          n = src.getUint8(i++);
          bitBuf = bitBuf | (n << leadBits); 
          b = (remaining >= 8) ? bitBuf & 0xFF : bitBuf & trailMask;
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    } else {
      const trailBits = (bits - leadBits) % 8;
      const trailMask = (2 ** trailBits) - 1;  
      return function(dest, src, offset) {
        let i = 0, j = offset;
        // preserve bits ahead of bitPos
        let d = dest.getUint8(j), n, b;   
        let bitBuf = (d & (0xFF ^ leadMask));
        let remaining = bits + bitPos;
        do {
          if (remaining > bitPos) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitPos);
          }
          if (remaining >= 8) {
            b = bitBuf & 0xFF;
          } else {
            // preserve bits at the destination sitting behind the trailing bits 
            d = dest.getUint8(j);
            b = (d & (0xFF ^ trailMask)) | (bitBuf & trailMask);
          }
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    }
  }
}

export function obtainCopyFunction(size) {
  return (size & 0x03) ? copy1 : copy4;
}

function copy1(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, src.getInt8(i));
  }
}

function copy4(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i));
  }
}

/*
function showBits(object) {
  const bitObj = {};
  for (const [ name, value ] of Object.entries(object)) {
    const s = value.toString(2);
    bitObj[name] = s.padStart(Math.ceil(s.length / 8) * 8, '0');
  }
  console.log(bitObj);
}
*/