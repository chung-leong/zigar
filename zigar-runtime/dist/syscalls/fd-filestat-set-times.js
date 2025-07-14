import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { extractTimes } from '../utils.js';

var fdFilestatSetTimes = mixin({
  fdFilestatSetTimes(fd, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      const target = stream.valueOf();
      const loc = this.getStreamLocation?.(fd);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = {};
      return this.triggerEvent('set_times', { ...loc, target, times, flags }, PosixError.EBADF);
    }, (result) => expectBoolean(result, PosixError.EBADF));
  },
});

export { fdFilestatSetTimes as default };
