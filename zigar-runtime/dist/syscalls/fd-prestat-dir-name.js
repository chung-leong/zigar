import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var fdPrestatDirName = mixin({
  fdPrestatDirName(fd, pathAddress, pathLen) {
    if (!this.customWASI?.wasiImport?.fd_prestat_get) {
      if (fd === 3) {
        return 0;
      } else {
        return PosixError.EBADF;
      }
    } else {
      return PosixError.ENOTSUP;
    }
  }
}) ;

export { fdPrestatDirName as default };
