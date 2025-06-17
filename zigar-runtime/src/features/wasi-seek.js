import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { notPromise, showPosixError } from '../utils.js';

export default mixin({
  wasi_fd_seek(fd, offset, whence, newoffset_ptr) {
    const dv = new DataView(this.memory.buffer);
    try {
      const pos = notPromise(this.changeStreamPointer(fd, offset, whence));
      dv.setUint32(newoffset_ptr, pos, true);
      return PosixError.NONE;
    } catch (err) {
      return showPosixError(err);
    }
  }
});
