import { PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdPwrite(fd, iovsAddress, iovsCount, offset, writtenAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, writer, rights, i = 0;
    let total = (process.env.BITS == 64) ? 0n : 0, ptr, len;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          [ writer, rights ] = this.getStream(fd, 'write');
          checkAccessRight(rights, PosixDescriptorRight.fd_write);
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
        }
        ptr = (process.env.BITS == 64) ? iovs.getBigUint64(i * iovsSize, le) : iovs.getUint32(i * iovsSize, le);
        len = (process.env.BITS == 64) ? iovs.getBigUint64(i * iovsSize + 8, le) : iovs.getUint32(i * iovsSize + 4, le);
        const chunk = new Uint8Array(process.env.BITS == 64 ? Number(len) : len);
        const pos = offset;
        this.moveExternBytes(chunk, ptr, false);
        total += len;
        offset += len;
        return writer.pwrite(chunk, pos);
      }, () => {
        if (++i < iovsCount) {
          return next();
        } else {
          this.copyUsize(writtenAddress, total);
        }
      });
    };
    return next();
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdPwrite: { async: true },
      fdPwrite1: { async: true },
    },

    fdPwrite1(fd, address, len, offset, writtenAddress, canWait) {
      return catchPosixError(canWait, PosixError.EIO, () => {        
        const [ writer, rights ] = this.getStream(fd);
        checkAccessRight(rights, PosixDescriptorRight.fd_write);
        const chunk = new Uint8Array(process.env.BITS == 64 ? Number(len) : len);
        this.moveExternBytes(chunk, address, false);
        return writer.pwrite(chunk, offset);
      }, () => this.copyUsize(writtenAddress, len));
    },
    /* c8 ignore next */
  } : undefined),
});
