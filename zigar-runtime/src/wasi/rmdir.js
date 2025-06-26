import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';

export default mixin({
  wasi_path_remove_directory(fd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const path = this.resolvePath(fd, path_address, path_len);
      return this.triggerEvent('rmdir', { path }, PosixError.ENOENT);
    }, (result) => {
      if (result === true) return PosixError.NONE 
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('boolean', result);
    });
  }
});
