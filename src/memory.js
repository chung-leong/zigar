export function obtainBitAlignFunction(bitPos, bitSize, toAligned) {
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

export function obtainClearFunction(size) {
  return (size & 0x03) ? clear1 : clear4;
}

function clear1(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, 0);
  }
}

function clear4(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, 0);
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
