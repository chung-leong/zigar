import { PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdPread(fd, iovsAddress, iovsCount, offset, readAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, reader, rights, i = 0;
    let total = (process.env.BITS == 64) ? 0n : 0, ptr, len;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          [ reader, rights ] = this.getStream(fd);
          checkAccessRight(rights, PosixDescriptorRight.fd_read);
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
        }
        len = (process.env.BITS == 64) ? iovs.getBigUint64(i * iovsSize + 8, le) : iovs.getUint32(i * iovsSize + 4, le);
        return reader.pread(process.env.BITS == 64 ? Number(len) : len, offset);
      }, (chunk) => {
        ptr = (process.env.BITS == 64) ? iovs.getBigUint64(i * iovsSize, le) : iovs.getUint32(i * iovsSize, le);
        this.moveExternBytes(chunk, ptr, true);
        const read = chunk.length;
        total += (process.env.BITS == 64) ? BigInt(read) : read;
        if (++i < iovsCount && read === len) {
          offset += (process.env.BITS == 64) ? BigInt(read) : read;
          return next();
        } else {
          this.copyUsize(readAddress, total);
        }
      });
    };
    return next();
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
        return reader.pread(len, offset);
      }, (chunk) => {
        this.moveExternBytes(chunk, address, true);
        this.copyUsize(readAddress, (process.env.BITS == 64) ? BigInt(chunk.length) : chunk.length);
      });
    },
    /* c8 ignore next */
  } : undefined),
});
