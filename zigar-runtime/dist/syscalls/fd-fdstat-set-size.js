import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';
import { safeInt } from '../utils.js';

var fdFdstatSetSize = mixin({
  fdFdstatSetSize(fd, newSize, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream ] = entry;
      checkStreamMethod(stream, 'truncate', PosixError.EINVAL);
      return stream.truncate(safeInt(newSize));
    });    
  },
});

export { fdFdstatSetSize as default };
