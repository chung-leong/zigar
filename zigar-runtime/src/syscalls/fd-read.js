import { PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdRead(fd, iovsAddress, iovsCount, readAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, reader, flags, rights, method, i = 0;
    let total = (process.env.BITS == 64) ? 0n : 0, ptr, len;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          [ reader, rights, flags ] = this.getStream(fd);
          checkAccessRight(rights, PosixDescriptorRight.fd_read);
          method = (flags & PosixDescriptorFlag.nonblock) ? reader.readnb : reader.read;
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
        }
        len = (process.env.BITS == 64) ? iovs.getBigUint64(i * iovsSize + 8, le) : iovs.getUint32(i * iovsSize + 4, le);
        return method.call(reader, process.env.BITS == 64 ? Number(len) : len);
      }, (chunk) => {
        ptr = (process.env.BITS == 64) ? iovs.getBigUint64(i * iovsSize, le) : iovs.getUint32(i * iovsSize, le);
        this.moveExternBytes(chunk, ptr, true);
        const read = chunk.length;
        total += (process.env.BITS == 64) ? BigInt(read) : read;
        if (++i < iovsCount && read === len) {
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
      fdRead: { async: true },
      fdRead1: { async: true },
    },

    fdRead1(fd, address, len, readAddress, canWait) {
      return catchPosixError(canWait, PosixError.EIO, () => {
        const [ reader, rights, flags ] = this.getStream(fd);
        checkAccessRight(rights, PosixDescriptorRight.fd_read);
        const method = (flags & PosixDescriptorFlag.nonblock) ? reader.readnb : reader.read;
        return method.call(reader, len);
      }, (chunk) => {
        this.moveExternBytes(chunk, address, true);
        this.copyUsize(readAddress, (process.env.BITS == 64) ? BigInt(chunk.length) : chunk.length);
      });
    },
    /* c8 ignore next */
  } : undefined),
});
