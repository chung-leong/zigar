import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var fdLockSet = mixin({
  fdLockSet(fd, flockAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.getStream(fd);
    });
  },
});

export { fdLockSet as default };
