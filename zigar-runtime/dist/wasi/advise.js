import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var advise = mixin({
  fd_advise(fd, offset, len, advice, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      return stream.advise?.(offset, len, advice);
    });
  }
});

export { advise as default };
