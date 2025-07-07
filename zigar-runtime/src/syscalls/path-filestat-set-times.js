import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { extractTimes } from '../utils.js';

export default mixin({
  pathFilestatSetTimes(dirFd, pathAddress, pathLen, atime, mtime, flags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const times = extractTimes(atime, mtime, flags);
      return this.triggerEvent('set_times', { ...loc, times }, PosixError.ENOENT);
    }, (result) => expectBoolean(result, PosixError.ENOENT));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathFilestatSetTimes: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
