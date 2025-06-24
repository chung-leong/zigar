import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var close = mixin({
  wasi_fd_close(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.wasi.pathMap?.delete?.(fd);
      this.closeStream(fd);
    });
  }
});

export { close as default };
