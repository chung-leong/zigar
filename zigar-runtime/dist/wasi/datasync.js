import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var datasync = mixin({
  fd_datasync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.datasync?.();
    });
  }
});

export { datasync as default };
