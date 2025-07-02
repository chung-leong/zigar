import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';

export default mixin({
  pathUnlinkFile(dirfd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
      return this.triggerEvent('unlink', loc, PosixError.ENOENT);
    }, (result) => {
      if (result === true) return PosixError.NONE 
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('boolean', result);
    });
  },
});
