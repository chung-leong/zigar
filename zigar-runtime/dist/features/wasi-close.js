import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { Deadlock, showPosixError } from '../errors.js';
import { isPromise } from '../utils.js';

var wasiClose = mixin({
  wasi_fd_close(fd, canWait = false) {
    const done = () => PosixError.NONE;
    try {
      this.wasi.pathMap?.delete?.(fd);
      const result = this.closeStream(fd);
      if (isPromise(result)) {
        if (canWait) {
          throw new Deadlock();
        }
        return result.then(done, showPosixError);
      }
      return done(result);
    } catch (err) {
      return showPosixError(err);
    }
  }
});

export { wasiClose as default };
