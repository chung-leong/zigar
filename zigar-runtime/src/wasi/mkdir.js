import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';

export default mixin({
  wasi_path_create_directory(fd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const path = this.obtainZigString(path_address, path_len);
      return this.triggerEvent('mkdir', { path }, PosixError.ENOENT);
    }, (result) => {
      if (result instanceof Map) return;
      if (result === true) return PosixError.EEXIST;
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('map or boolean', result);
    });
  }
});
