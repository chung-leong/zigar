import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdPread(fd, iovsAddress, iovsCount, offset, readAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, reader, i = 0;
    let read = (process.env.BITS == 64) ? 0n : 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          reader = this.getStream(fd);
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
        }
        const len = (process.env.BITS == 64) 
                  ? iovs.getBigUint64(i * iovsSize + 8, le)
                  : iovs.getUint32(i * iovsSize + 4, le);
        return reader.pread(process.env.BITS == 64 ? Number(len) : len, offset);
      }, (chunk) => {
        const ptr = (process.env.BITS == 64) 
                  ? iovs.getBigUint64(i * iovsSize, le) 
                  : iovs.getUint32(i * iovsSize, le);
        this.moveExternBytes(chunk, ptr, true);
        read += (process.env.BITS == 64) ? BigInt(chunk.length) : chunk.length;
        if (++i < iovsCount) {
          offset += (process.env.BITS == 64) ? BigInt(chunk.byteLength) : chunk.byteLength;
          return next();
        } else {
          this.copyUsize(readAddress, read);
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
        const reader = this.getStream(fd);
        return reader.pread(len, offset);
      }, (chunk) => {
        this.moveExternBytes(chunk, address, true);
        this.copyUsize(readAddress, (process.env.BITS == 64) ? BigInt(chunk.length) : chunk.length);
      });
    },
    /* c8 ignore next */
  } : undefined),
});
