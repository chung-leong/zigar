import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

const TimeFlag = {
  atime: 1 << 0,
  atime_now: 1 << 1,
  mtime: 1 << 2,
  mtime_now: 1 << 3,
};

const now = () => new Date() * 1000;

function extractTimes(st_atim, st_mtim, fst_flags) {
  const times = {};
  if (fst_flags & TimeFlag.atime) {
    times.atime = st_atim;
  } else if (fst_flags & TimeFlag.atime_now) {
    times.atime = now();
  }
  if (fst_flags & TimeFlag.mtime) {
    times.mtime = st_mtim;
  } else if (fst_flags & TimeFlag.mtime_now) {
    times.mtime = now();
  }
  return times;
}

var fileSetTimes = mixin({
  fdFilestatSetTimes(fd, st_atim, st_mtim, fst_flags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const loc = this.getStreamLocation?.(fd);
      if (!loc) {
        return false;
      }
      const times = extractTimes(st_atim, st_mtim, fst_flags);
      return this.triggerEvent('set_times', { ...loc, times }, PosixError.EBADF);
    }, (success) => (success) ? PosixError.NONE : PosixError.EBADF);
  },
  pathFilestatSetTimes(dirfd, path_address, path_len, st_atim, st_mtim, fst_flags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
      const times = extractTimes(st_atim, st_mtim, fst_flags);
      return this.triggerEvent('set_times', { ...loc, times }, PosixError.ENOENT);
    }, (success) => (success) ? PosixError.NONE : PosixError.ENOENT);
  },
});

export { fileSetTimes as default };
