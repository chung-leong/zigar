import { mixin } from '../environment.js';
import { createView } from '../utils.js';

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
        const len = iovs.getUint32(i * iovsSize + 4, true);
        const ptr = iovs.getUint32(i * iovsSize, true);
        const chunk = new Uint8Array(len);
        this.moveExternBytes(chunk, ptr, false);
        written += len;
        return writer.write(chunk);
      }, () => {
        if (i++ < iovs_count) {
          return next();
        } else {
          const writtenDV = createView(4);
          writtenDV.setUint32(0, written, this.littleEndian);
          this.moveExternBytes(writtenDV, writtenAddress, true);
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
      }, () => {
        const writteDV = createView(4);
        writteDV.setUint32(0, chunk.byteLength, this.littleEndian);
        this.moveExternBytes(writteDV, writtenAddress, true);
      });
    },
    /* c8 ignore next */
  } : undefined),
});
