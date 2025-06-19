import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { notPromise, showPosixError } from '../errors.js';

var wasiRead = mixin({
  wasi_fd_read(fd, iovs_ptr, iovs_count, read_ptr) {
    const dv = new DataView(this.memory.buffer);
    let read = 0;
    for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
      const buf_ptr = dv.getUint32(p, true);
      const buf_len = dv.getUint32(p + 4, true);
      if (buf_len > 0) {
        try {
          read += notPromise(this.readBytes(fd, buf_ptr, buf_len));
        } catch (err) {
          return showPosixError(err);
        }
      }
    }
    dv.setUint32(read_ptr, read, true);
    return PosixError.NONE;
  }
});

export { wasiRead as default };
