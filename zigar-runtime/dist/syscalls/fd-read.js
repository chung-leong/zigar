import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

var fdRead = mixin({
  fdRead(fd, iovsAddress, iovsCount, readAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, reader, i = 0;
    let read = 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          reader = this.getStream(fd);
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
        }
        const len = iovs.getUint32(i * iovsSize + 4, le);
        return reader.read(len);
      }, (chunk) => {
        const ptr = iovs.getUint32(i * iovsSize, le);
        this.moveExternBytes(chunk, ptr, true);
        read += chunk.length;
        if (++i < iovsCount) {
          return next();
        } else {
          this.copyUsize(readAddress, read);
        }
      });
    };
    return next();
  },
});

export { fdRead as default };
