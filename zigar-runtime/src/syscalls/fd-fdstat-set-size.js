import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';
import { safeInt } from '../utils.js';

export default mixin({
  fdFdstatSetSize(fd, newSize, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream ] = entry;
      checkStreamMethod(stream, 'truncate', PosixError.EINVAL);
      return stream.truncate(safeInt(newSize));
    });    
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdFdstatSetSize: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
