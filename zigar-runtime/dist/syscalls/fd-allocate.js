import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var fdAllocate = mixin({
  fdAllocate(fd, offset, len, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.allocate(offset, len);
    });
  },
});

export { fdAllocate as default };
