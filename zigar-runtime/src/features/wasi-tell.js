import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { notPromise, showPosixError } from '../errors.js';

export default mixin({
  wasi_fd_tell(fd, newoffset_ptr) {
    const dv = new DataView(this.memory.buffer);
    try {
      const pos = notPromise(this.getStreamPointer(fd));
      dv.setUint32(newoffset_ptr, pos, true);              
      return PosixError.NONE;
    } catch (err) {
      return showPosixError(err);
    }
  }
});
