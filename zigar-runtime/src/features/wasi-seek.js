import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { Deadlock, showPosixError } from '../errors.js';
import { isPromise } from '../utils.js';

export default mixin({
  wasi_fd_seek(fd, offset, whence, newoffset_ptr, canWait = false) {
    try {
      const dv = new DataView(this.memory.buffer);
      const done = (pos) => {
        dv.setUint32(newoffset_ptr, pos, true);
        return PosixError.NONE;
      };
      const result = this.changeStreamPointer(fd, offset, whence);
      if (isPromise(result)) {
        if (!canWait) {
          throw new Deadlock();
        }
        return result.then(done, showPosixError);
      } else {
        return done(result);
      }
    } catch (err) {
      return showPosixError(err);
    }
  }
});
