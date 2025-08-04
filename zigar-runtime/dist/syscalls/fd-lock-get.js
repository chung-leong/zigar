import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var fdLockGet = mixin({
  fdLockGet(fd, flockAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.getStream(fd);
    });
  },
});

export { fdLockGet as default };
