import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var write = mixin({
  wasi_fd_write(fd, iovs_ptr, iovs_count, written_ptr, canWait) {
    const dv = new DataView(this.memory.buffer);
    let written = 0, i = 0, p = iovs_ptr;
    const next = () => {
      return catchPosixError(canWait, PosixError.EIO, () => {
        const ptr = dv.getUint32(p, true);
        const len = dv.getUint32(p + 4, true);
        p += 8;
        i++;
        written += len;
        return this.writeBytes(fd, ptr, len);
      }, () => {
        if (i < iovs_count) {
          next(); 
        } else {
          dv.setUint32(written_ptr, written, true);
        }
      });
    };
    return next();
  }
});

export { write as default };
