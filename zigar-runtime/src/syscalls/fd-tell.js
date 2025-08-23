import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';

export default mixin({
  fdTell(fd, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'tell');
      return stream.tell();
    }, (pos) => this.copyUint64(newOffsetAddress, pos));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdTell: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
