import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';

var pathRemoveDirectory = mixin({
  pathRemoveDirectory(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('rmdir', loc, PosixError.ENOENT);
    }, (result) => expectBoolean(result, PosixError.ENOENT));
  },
});

export { pathRemoveDirectory as default };
