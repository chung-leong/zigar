import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { createView, usizeByteSize } from '../utils.js';

export default mixin({
  environGet(environAddress, environBufAddress) {
    let size = 0, count = 0;
    for (const array of this.envVariables) {
      size += array.length;
      count++;
    }
    const ptrDV = createView(usizeByteSize * count);
    const bytes = new Uint8Array(size);
    let p = 0, b = 0, le = this.littleEndian;
    for (const array of this.envVariables) {
      if (process.env.BITS == 64) {
        ptrDV.setBigUint64(p, environBufAddress + BigInt(b), le);
        p += 8;
      } else {
        ptrDV.setUint32(p, environBufAddress + b, le);
        p += 4;
      }
      bytes.set(array, b);
      b += array.length;
    }
    this.moveExternBytes(ptrDV, environAddress, true);
    this.moveExternBytes(bytes, environBufAddress, true);
    return PosixError.NONE;
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      environGet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
