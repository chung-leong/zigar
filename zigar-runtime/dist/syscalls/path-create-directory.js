import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';

var pathCreateDirectory = mixin({
  pathCreateDirectoryEvent: 'mkdir',
  pathCreateDirectory(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('mkdir', loc, PosixError.ENOENT);
    }, (result) => {
      if (result === undefined) {
        return PosixError.ENOTSUP;
      }
      if (result instanceof Map) {
        return PosixError.EEXIST;
      }
      return expectBoolean(result, PosixError.ENOENT);
    });
  },
});

export { pathCreateDirectory as default };
