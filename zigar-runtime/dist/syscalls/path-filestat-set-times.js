import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { extractTimes } from '../utils.js';

var pathFilestatSetTimes = mixin({
  pathFilestatSetTimes(dirfd, path_address, path_len, st_atim, st_mtim, fst_flags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
      const times = extractTimes(st_atim, st_mtim, fst_flags);
      return this.triggerEvent('set_times', { ...loc, times }, PosixError.ENOENT);
    }, (result) => expectBoolean(result, PosixError.ENOENT));
  },
});

export { pathFilestatSetTimes as default };
