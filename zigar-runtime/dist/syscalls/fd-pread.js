import { PosixError, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight, checkStreamMethod } from '../errors.js';
import { createView, readUsize, readUsizeSafe, usizeByteSize, safeInt } from '../utils.js';
import './copy-int.js';

var fdPread = mixin({
  fdPread(fd, iovsAddress, iovsCount, offset, readAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    const ops = [];
    let total = 0;
    return catchPosixError(canWait, PosixError.EIO, () => {        
      const[ reader, rights ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_read);
      checkStreamMethod(reader, 'pread');
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      return reader.pread(total, safeInt(offset));
    }, (chunk) => {
      let { byteOffset: pos, byteLength: remaining, buffer } = chunk;
      for (const { ptr, len } of ops) {
        if (remaining > 0) {
          const part = new DataView(buffer, pos, Math.min(remaining, len));
          this.moveExternBytes(part, ptr, true);
          pos += len;
          remaining -= len;
        }
      }
      this.copyUint32(readAddress, chunk.length);
    });
  },
});

export { fdPread as default };
