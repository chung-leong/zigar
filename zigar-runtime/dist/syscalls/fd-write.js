import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-usize.js';

var fdWrite = mixin({
  fdWrite(fd, iovsAddress, iovsCount, writtenAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    let iovs, writer, i = 0;
    let written = 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
          writer = this.getStream(fd, 'write');
        }
        const le = this.littleEndian;
        const ptr = iovs.getUint32(i * iovsSize, le);
        const len = iovs.getUint32(i * iovsSize + 4, le);
        const chunk = new Uint8Array(len);
        this.moveExternBytes(chunk, ptr, false);
        written += len;
        return writer.write(chunk);
      }, () => {
        if (++i < iovsCount) {
          return next();
        } else {
          this.copyUint32(writtenAddress, written);
        }
      });
    };
    return next();
  },
});

export { fdWrite as default };
