import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';

export default mixin({
  fdSeek(fd, offset, whence, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'seek');
      return stream.seek(offset, whence);
    }, (pos) => this.copyUint64(newOffsetAddress, pos));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdSeek: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
