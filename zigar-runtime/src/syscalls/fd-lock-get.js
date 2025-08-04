import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  fdLockGet(fd, flockAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdLockGet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
