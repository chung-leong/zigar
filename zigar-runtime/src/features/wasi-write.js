import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { notPromise, showPosixError } from '../utils.js';

export default mixin({
  wasi_fd_write(fd, iovs_ptr, iovs_count, written_ptr) {
    const dv = new DataView(this.memory.buffer);
    let written = 0;
    for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
      const buf_ptr = dv.getUint32(p, true);
      const buf_len = dv.getUint32(p + 4, true);
      if (buf_len > 0) {
        try {
          // writeBytes() can return promise in the main stream only
          // when a call is relayed from a thread, a synchronously wait occurs
          // regardless of whether writeBytes() returns a promise or not
          notPromise(this.writeBytes(fd, buf_ptr, buf_len));
        } catch (err) {
          return showPosixError(err);
        }
        written += buf_len;
      }
    }
    dv.setUint32(written_ptr, written, true);
    return PosixError.NONE;
  }
});
