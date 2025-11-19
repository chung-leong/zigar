import { PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight } from '../errors.js';
import { createView, readUsize, readUsizeSafe, usizeByteSize } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdWrite(fd, iovsAddress, iovsCount, writtenAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    let total = 0;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const[ writer, rights, flags ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_write);
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      const ops = [];
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      const buffer = new ArrayBuffer(total);
      let pos = 0;
      for (const { ptr, len } of ops) {
        const part = new DataView(buffer, pos, len);
        this.moveExternBytes(part, ptr, false);
        pos += len;
      }
      const chunk = new Uint8Array(buffer);
      const method = (flags & PosixDescriptorFlag.nonblock) ? writer.writenb : writer.write;
      return method.call(writer, chunk);
    }, () => { 
      if (writtenAddress) {
        this.copyUint32(writtenAddress, total);
      }
    });
  },
  fdWriteStderr(chunk, canWait) {
    catchPosixError(true, PosixError.EBADF, () => {
      const[ writer, rights, flags ] = this.getStream(2);
      checkAccessRight(rights, PosixDescriptorRight.fd_write);
      const method = (flags & PosixDescriptorFlag.nonblock) ? writer.writenb : writer.write;
      return method.call(writer, chunk);
    });
    return 0;
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdWrite: { async: true },
      fdWrite1: { async: true },
      fdWriteStderr: { async: true },
    },

    fdWrite1(fd, address, len, writtenAddress, canWait) {
      return catchPosixError(canWait, PosixError.EBADF, () => {        
        const [ writer, rights, flags ] = this.getStream(fd);
        checkAccessRight(rights, PosixDescriptorRight.fd_write);
        const method = (flags & PosixDescriptorFlag.nonblock) ? writer.writenb : writer.write;
        const chunk = new Uint8Array(len);
        this.moveExternBytes(chunk, address, false);
        return method.call(writer, chunk);
      }, () => {
        if (writtenAddress) {
          this.copyUint32(writtenAddress, len);
        }
      });
    },
    /* c8 ignore next */
  } : undefined),
});
