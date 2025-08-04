import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, usizeByteSize } from '../utils.js';
import './copy-int.js';

var fdPwrite = mixin({
  fdPwrite(fd, iovsAddress, iovsCount, offset, writtenAddress, canWait) {
    const iovsSize = usizeByteSize * 2;
    const le = this.littleEndian;
    let iovs, writer, i = 0;
    let written = 0;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        if (!iovs) {
          iovs = createView(iovsSize * iovsCount);
          this.moveExternBytes(iovs, iovsAddress, false);
          writer = this.getStream(fd, 'write');
        }
        const ptr = iovs.getUint32(i * iovsSize, le);
        const len = iovs.getUint32(i * iovsSize + 4, le);
        const chunk = new Uint8Array(len);
        const pos = offset;
        this.moveExternBytes(chunk, ptr, false);
        written += len;
        offset += len;
        return writer.pwrite(chunk, pos);
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
});

export { fdPwrite as default };
