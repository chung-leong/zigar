import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';
import { safeInt } from '../utils.js';

export default mixin({
  fdAllocate(fd, offset, len, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'allocate', PosixError.ENOSPC);
      return stream.allocate(safeInt(offset), safeInt(len));
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdAllocate: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
