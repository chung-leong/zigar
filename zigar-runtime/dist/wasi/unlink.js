import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var unlink = mixin({
  wasi_path_unlink_file(fd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const path = this.obtainZigString(path_address, path_len);
      return this.triggerEvent('unlink', { path }, PosixError.ENOENT);
    }, (result) => {
      if (result === true) return PosixError.NONE 
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('boolean', result);
    });
  }
});

export { unlink as default };
