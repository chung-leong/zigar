import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  wasi_fd_datasync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.datasync?.();
    });
  }
});
