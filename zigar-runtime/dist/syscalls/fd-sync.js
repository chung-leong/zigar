import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { hasMethod } from '../utils.js';

var fdSync = mixin({
  fdSync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'sync')) {
        return stream.sync?.();
      }
    });
  },
});

export { fdSync as default };
