import { isPromise } from 'util/types';
import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { Deadlock, showPosixError } from '../errors.js';

var wasiWrite = mixin({
  wasi_fd_write(fd, iovs_ptr, iovs_count, written_ptr, canWait = false) {
    const dv = new DataView(this.memory.buffer);
    let written = 0, i = 0, p = iovs_ptr;
    const next = () => {
      try {
        if (i < iovs_count) {
          const ptr = dv.getUint32(p, true);
          const len = dv.getUint32(p + 4, true);
          p += 8;
          i++;
          const result = this.writeBytes(fd, ptr, len);
          written += len;
          if (isPromise(result)) {
            if (!canWait) {
              throw new Deadlock();
            }
            return result.then(next, showPosixError);
          } else {
            return next();
          }
        } else {
          dv.setUint32(written_ptr, written, true);
          return PosixError.NONE;
        }
      } catch (err) {
        return showPosixError(err);
      }
    };
    return next();
  }
});

export { wasiWrite as default };
