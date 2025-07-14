import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var fdClose = mixin({
  fdClose(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.setStreamLocation?.(fd); 
      return this.destroyStreamHandle(fd);
    });
  },
});

export { fdClose as default };
