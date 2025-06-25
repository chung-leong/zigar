import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  wasi_fd_read(fd, iovs_ptr, iovs_count, read_ptr, canWait) {
    const dv = new DataView(this.memory.buffer);
    let read = 0, i = 0, p = iovs_ptr;
    const next = (len) => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        const ptr = dv.getUint32(p, true);
        const len = dv.getUint32(p + 4, true);
        p += 8;
        i++;
        return this.readBytes(fd, ptr, len);
      }, (len) => {
        read += len;
        if (i < iovs_count) {
          next();
        } else {
          dv.setUint32(read_ptr, read, true);
        }
      });
    };
    return next(0);
  }
});
