import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { hasMethod } from '../utils.js';

export default mixin({
  fdSync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'sync')) {
        return stream.sync?.();
      }
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdSync: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
