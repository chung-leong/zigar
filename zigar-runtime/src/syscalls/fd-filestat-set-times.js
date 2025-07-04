import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { extractTimes } from '../utils.js';

export default mixin({
  fdFilestatSetTimes(fd, st_atim, st_mtim, fst_flags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      const target = stream.valueOf();
      const loc = this.getStreamLocation?.(fd);
      const times = extractTimes(st_atim, st_mtim, fst_flags);
      return this.triggerEvent('set_times', { ...loc, target, times }, PosixError.EBADF);
    }, (result) => expectBoolean(result, PosixError.EBADF));
  },
});
