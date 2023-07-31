function copy1x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, src.getInt8(i));
  }
}

function copy2x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 2) {
    dest.setInt16(i, src.getInt16(i));
  }
}

function copy4x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i));
  }
}

function copy4x_le(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i, true), true);
  }
}

function copy4x_le_unsigned(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setUint32(i, src.getUint32(i, true), true);
  }
}

function copy8x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, src.getInt32(i));
    dest.setInt32(i + 4, src.getInt32(i + 4));
  }
}

function copy8x_le(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, src.getInt32(i, true), true);
    dest.setInt32(i + 4, src.getInt32(i + 4, true), true);
  }
}

function copy8x_64(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setBigUint64(i, src.getBigUint64(i));
  }
}

function copy8x_64_le(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setBigUint64(i, src.getBigUint64(i, true), true);
  }
}

function copy32_le(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
  dest.setInt32(16, src.getInt32(16, true), true);
  dest.setInt32(20, src.getInt32(20, true), true);
  dest.setInt32(24, src.getInt32(24, true), true);
  dest.setInt32(28, src.getInt32(28, true), true);
}

const src = new DataView(new ArrayBuffer(32));
const dest = new DataView(new ArrayBuffer(32));

for (let i = 0; i < 4; i++) {
  console.time('copy1x');
  for (let i = 0; i < 1000000; i++) {
    copy1x(dest, src);
  }
  console.timeEnd('copy1x');

  console.time('copy2x');
  for (let i = 0; i < 1000000; i++) {
    copy2x(dest, src);
  }
  console.timeEnd('copy2x');

  console.time('copy4x');
  for (let i = 0; i < 1000000; i++) {
    copy4x(dest, src);
  }
  console.timeEnd('copy4x');

  console.time('copy4x_le');
  for (let i = 0; i < 1000000; i++) {
    copy4x_le(dest, src);
  }
  console.timeEnd('copy4x_le');

  console.time('copy4x_le_unsigned');
  for (let i = 0; i < 1000000; i++) {
    copy4x_le_unsigned(dest, src);
  }
  console.timeEnd('copy4x_le_unsigned');

  console.time('copy8x');
  for (let i = 0; i < 1000000; i++) {
    copy8x(dest, src);
  }
  console.timeEnd('copy8x');

  console.time('copy8x_le');
  for (let i = 0; i < 1000000; i++) {
    copy8x_le(dest, src);
  }
  console.timeEnd('copy8x_le');

  console.time('copy8x_64');
  for (let i = 0; i < 1000000; i++) {
    copy8x_64(dest, src);
  }
  console.timeEnd('copy8x_64');

  console.time('copy8x_64_le');
  for (let i = 0; i < 1000000; i++) {
    copy8x_64_le(dest, src);
  }
  console.timeEnd('copy8x_64_le');

  console.time('copy32_le');
  for (let i = 0; i < 1000000; i++) {
    copy32_le(dest, src);
  }
  console.timeEnd('copy32_le');

  console.log('');
}
