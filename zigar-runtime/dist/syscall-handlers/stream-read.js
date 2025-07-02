import { mixin } from '../environment.js';
import { usizeByteSize } from '../utils.js';

var streamRead = mixin({
  fdRead(fd, iovsAddress, iovsCount, readAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    let iovs, reader, read = 0, i = 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
          reader = this.getStream(fd);
        }
        const len = iovs.getUint32(i * iovsSize + 4, true);
        return reader.read(len);
      }, (chunk) => {
        const ptr = iovs.getUint32(i * iovsSize, true);
        this.moveExternBytes(chunk, ptr, true);
        read += chunk.byteLength;
        if (i++ < iovs_count) {
          return next();
        } else {
          const readDV = createView(4);
          readDV.setUint32(0, read, this.littleEndian);
          this.moveExternBytes(readDV, readAddress, true);
        }
      });
    };
    return next();
  },
});

export { streamRead as default };
