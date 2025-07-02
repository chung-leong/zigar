import { mixin } from '../environment.js';
import { createView } from '../utils.js';

var streamWrite = mixin({
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
});

export { streamWrite as default };
