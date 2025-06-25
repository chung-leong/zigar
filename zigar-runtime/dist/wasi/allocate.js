import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var allocate = mixin({
  fd_allocate(fd, offset, len, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.allocate(offset, len, advice);
    });
  }
});

export { allocate as default };
