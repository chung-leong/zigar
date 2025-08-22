import { PosixError, PosixLookupFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { decodeFlags, extractTimes } from '../utils.js';

export default mixin({
  pathFilestatSetTimes(dirFd, lFlags, pathAddress, pathLen, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = decodeFlags(lFlags, PosixLookupFlag) ;
      return this.triggerEvent('set_times', { ...loc, times, flags });
    }, (result) => {
      if (result === undefined) {
        return PosixError.ENOTSUP;
      }
      expectBoolean(result, PosixError.ENOENT)
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathFilestatSetTimes: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
