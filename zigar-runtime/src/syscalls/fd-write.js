import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdWrite(fd, iovsAddress, iovsCount, writtenAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, writer, i = 0;
    let written = (process.env.BITS == 64) ? 0n : 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          writer = this.getStream(fd, 'write');
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
        }
        const ptr = (process.env.BITS == 64) 
                  ? iovs.getBigUint64(i * iovsSize, le) 
                  : iovs.getUint32(i * iovsSize, le);
        const len = (process.env.BITS == 64) 
                  ? iovs.getBigUint64(i * iovsSize + 8, le)
                  : iovs.getUint32(i * iovsSize + 4, le);
        const chunk = new Uint8Array(process.env.BITS == 64 ? Number(len) : len);
        this.moveExternBytes(chunk, ptr, false);
        written += len;
        return writer.write(chunk);
      }, () => {
        if (++i < iovsCount) {
          return next();
        } else {
          this.copyUsize(writtenAddress, written);
        }
      });
    };
    return next();
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdWrite: { async: true },
      fdWrite1: { async: true },
    },

    fdWrite1(fd, address, len, writtenAddress, canWait) {
      return catchPosixError(canWait, PosixError.EIO, () => {        
        const writer = this.getStream(fd);
        const chunk = new Uint8Array(process.env.BITS == 64 ? Number(len) : len);
        this.moveExternBytes(chunk, address, false);
        return writer.write(chunk);
      }, () => this.copyUsize(writtenAddress, len));
    },
    /* c8 ignore next */
  } : undefined),
});
