import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default mixin({
  fdDatasync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.datasync?.();
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdDatasync: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
