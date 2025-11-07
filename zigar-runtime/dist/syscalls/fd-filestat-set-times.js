import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { extractTimes } from '../utils.js';

var fdFilestatSetTimes = mixin({
  fdFilestatSetTimesEvent: 'utimes',
  fdFilestatSetTimes(fd, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      const target = stream.valueOf();
      const loc = this.getStreamLocation?.(fd);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = {};
      return this.triggerEvent('utimes', { ...loc, target, times, flags });
    }, (result) => (result === undefined) ? PosixError.ENOTCAPABLE : expectBoolean(result, PosixError.EBADF));
  },
});

export { fdFilestatSetTimes as default };
