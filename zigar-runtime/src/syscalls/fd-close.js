import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  fdClose(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.setStreamLocation?.(fd); 
      return this.destroyStreamHandle(fd);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdClose: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
