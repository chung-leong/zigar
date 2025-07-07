import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  fdAllocate(fd, offset, len, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.allocate(offset, len);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdAllocate: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
