import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  wasi_fd_close(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.wasi.pathMap?.delete?.(fd);
      const result = this.closeStream(fd);
    });
  }
});
