import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { Deadlock, showPosixError } from '../errors.js';
import { isPromise } from '../utils.js';

var wasiRead = mixin({
  wasi_fd_read(fd, iovs_ptr, iovs_count, read_ptr, canWait = false) {
    const dv = new DataView(this.memory.buffer);
    let read = 0, i = 0, p = iovs_ptr;
    const next = (len) => {
      try {
        // add len from previous call
        read += len;
        if (i < iovs_count) {
          const ptr = dv.getUint32(p, true);
          const len = dv.getUint32(p + 4, true);
          p += 8;
          i++;
          const result = this.readBytes(fd, ptr, len);
          if (isPromise(result)) {
            if (!canWait) {
              throw new Deadlock();
            }
            return result.then(next, showPosixError);
          } else {
            return next(result);
          }
        } else {
          dv.setUint32(read_ptr, read, true);
          return PosixError.NONE;
        }
      } catch (err) {
        return showPosixError(err);
      }
    };
    return next(0);
  }
}) ;

export { wasiRead as default };
