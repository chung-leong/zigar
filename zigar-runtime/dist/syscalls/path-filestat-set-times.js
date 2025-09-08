import { PosixError, PosixLookupFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { extractTimes, decodeFlags } from '../utils.js';

var pathFilestatSetTimes = mixin({
  pathFilestatSetTimesEvent: 'set_times',
  pathFilestatSetTimes(dirFd, lFlags, pathAddress, pathLen, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = decodeFlags(lFlags, PosixLookupFlag) ;
      return this.triggerEvent('set_times', { ...loc, times, flags });
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

export { pathFilestatSetTimes as default };
