import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';
import { safeInt } from '../utils.js';

var fdAllocate = mixin({
  fdAllocate(fd, offset, len, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'allocate', PosixError.ENOSPC);
      return stream.allocate(safeInt(offset), safeInt(len));
    });
  },
});

export { fdAllocate as default };
