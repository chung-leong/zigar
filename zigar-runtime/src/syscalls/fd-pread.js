import { PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight } from '../errors.js';
import { createView, readUsize, readUsizeSafe, safeInt, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdPread(fd, iovsAddress, iovsCount, offset, readAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    const ops = [];
    let total = 0;
    return catchPosixError(canWait, PosixError.EIO, () => {        
      const[ reader, rights ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_read);
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
      let { byteOffset: pos, buffer } = chunk;
      for (const { ptr, len } of ops) {
        const part = new DataView(buffer, pos, len);
        this.moveExternBytes(part, ptr, true);
        pos += len;
      }
      this.copyUint32(readAddress, chunk.length);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdPread: { async: true },
      fdPread1: { async: true },
    },

    fdPread1(fd, address, len, offset, readAddress, canWait) {
      return catchPosixError(canWait, PosixError.EIO, () => {
        const [ reader, rights ] = this.getStream(fd);
        checkAccessRight(rights, PosixDescriptorRight.fd_read);
        return reader.pread(len, safeInt(offset));
      }, (chunk) => {
        this.moveExternBytes(chunk, address, true);
        this.copyUint32(readAddress, chunk.length);
      });
    },
    /* c8 ignore next */
  } : undefined),
});
