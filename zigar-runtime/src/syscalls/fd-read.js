import { PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight } from '../errors.js';
import { createView, readUsize, readUsizeSafe, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdRead(fd, iovsAddress, iovsCount, readAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    const ops = [];
    let total = 0;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const[ reader, rights, flags ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_read);
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      const method = (flags & PosixDescriptorFlag.nonblock) ? reader.readnb : reader.read;
      return method.call(reader, total);
    }, (chunk) => {
      let { byteOffset: pos, byteLength: remaining, buffer } = chunk;
      for (const { ptr, len } of ops) {
        const copying = Math.min(remaining, len);
        if (copying > 0) {
          const part = new DataView(buffer, pos, copying);
          this.moveExternBytes(part, ptr, true);
          pos += copying;
          remaining -= copying;
        }
      }
      this.copyUint32(readAddress, chunk.length);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdRead: { async: true },
      fdRead1: { async: true },
    },

    fdRead1(fd, address, len, readAddress, canWait) {
      return catchPosixError(canWait, PosixError.EBADF, () => {
        const [ reader, rights, flags ] = this.getStream(fd);
        checkAccessRight(rights, PosixDescriptorRight.fd_read);
        const method = (flags & PosixDescriptorFlag.nonblock) ? reader.readnb : reader.read;
        return method.call(reader, len);
      }, (chunk) => {
        this.moveExternBytes(chunk, address, true);
        this.copyUint32(readAddress, chunk.length);
      });
    },
    /* c8 ignore next */
  } : undefined),
});
