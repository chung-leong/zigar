import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';

var rmdir = mixin({
  wasi_path_remove_directory(dirfd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
      return this.triggerEvent('rmdir', loc, PosixError.ENOENT);
    }, (result) => {
      if (result === true) return PosixError.NONE 
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('boolean', result);
    });
  }
});

export { rmdir as default };
