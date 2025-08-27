import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';
import { safeInt } from '../utils.js';

var fdSeek = mixin({
  fdSeek(fd, offset, whence, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'seek');
      return stream.seek(safeInt(offset), whence);
    }, (pos) => this.copyUint64(newOffsetAddress, pos));
  },
});

export { fdSeek as default };
