import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './usize-copy.js';

export default mixin({
  fdWrite(fd, iovsAddress, iovsCount, writtenAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    let iovs, writer, written = 0, i = 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
          writer = this.getStream(fd, 'write');
        }
        const ptr = iovs.getUint32(i * iovsSize, true);
        const len = iovs.getUint32(i * iovsSize + 4, true);
        const chunk = new Uint8Array(len);
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
      writeBytes: { async: true },
    },

    writeBytes(fd, address, len, writtenAddress, canWait) {
      return catchPosixError(canWait, PosixError.EIO, () => {
        const writer = this.getStream(fd);
        const chunk = new Uint8Array(len);
        this.moveExternBytes(chunk, address, false);
        return writer.write(chunk);
      }, () => this.copyUsize(writtenAddress, len));
    },
    /* c8 ignore next */
  } : undefined),
});
