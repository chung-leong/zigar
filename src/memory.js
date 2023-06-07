export function copyBits(dest, src, offset, bitOffset, bits) {
  const shift = 8 - bitOffset;
  const leadMask = ((2 ** shift) - 1) << bitOffset;
  const trailMask = 0xFF ^ leadMask;
  var i = offset, j = 0;
  // read leading byte, mask off bits before bit offset, and shift them to the start of the byte
  var n = src.getUint8(i++);
  var overhang = (n & leadMask) >>> bitOffset;
  var remaining = bits - shift;
  var b;
  while (remaining >= 8) {
    // read next bytes, shift it forward, and combine it with bits that came before
    n = src.getUint8(i++);
    b = overhang | ((n & trailMask) << shift);
    dest.setUint8(j++, b);
    // new overhang
    overhang = (n & leadMask) >>> bitOffset;
    remaining -= 8;
  }
  if (remaining > 0) {
    const finalMask = ((2 ** remaining) - 1) << bitOffset;    
    n = src.getUint8(i);
    b = overhang | ((n & finalMask) << shift);
  } else {
    b = overhang;
  }
  dest.setUint8(j, b);
}

export function applyBits(dest, src, offset, bitOffset, bits) {
  const shift = 8 - bitOffset;
  const leadMask = ((2 ** shift) - 1) << bitOffset;
  const trailMask = 0xFF ^ leadMask;
  var i = offset, j = 0;
  var b = dest.getUint8(i);
  var leftOver = b & trailMask;
  var remaining = bits + bitOffset;
  var n;
  while (remaining >= 8) {
    n = src.getUint8(j++);
    b = leftOver | ((n << bitOffset) & leadMask);
    dest.setUint8(i++, b);
    leftOver = (n >> shift) & trailMask;
    remaining -= 8;
  }
  if (remaining > 0) {
    const finalMask = ((2 ** remaining) - 1) << bitOffset;
    b = dest.getUint8(i);
    b = (b & finalMask) | (leftOver & (0xFF ^ finalMask));   
    dest.setUint8(i, b)
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
