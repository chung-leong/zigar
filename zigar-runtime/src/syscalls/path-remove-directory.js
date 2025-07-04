import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';

export default mixin({
  pathRemoveDirectory(dirfd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
      return this.triggerEvent('rmdir', loc, PosixError.ENOENT);
    }, (result) => expectBoolean(result, PosixError.ENOENT));
  },
});
