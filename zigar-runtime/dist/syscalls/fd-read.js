import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-usize.js';

var fdRead = mixin({
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
        const len = iovs.getUint32(i * iovsSize + usizeByteSize, true);
        return reader.read(len);
      }, (chunk) => {
        const ptr = iovs.getUint32(i * iovsSize, true);
        this.moveExternBytes(chunk, ptr, true);
        read += chunk.byteLength;
        if (++i < iovsCount) {
          return next();
        } else {
          this.copyUint32(readAddress, read);
        }
      });
    };
    return next();
  },
});

export { fdRead as default };
