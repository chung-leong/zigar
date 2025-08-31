import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  fdPrestatDirName(fd, pathAddress, pathLen) {
    if (!this.customPreopened) {
      if (fd === 3) {
        return 0;
      } else {
        return -PosixError.EBADF;
      }
    } else {
      return -PosixError.ENOTSUP;
    }
  }
}) : undefined;
