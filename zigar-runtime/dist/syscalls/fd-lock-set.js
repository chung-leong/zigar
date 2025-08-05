import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { hasMethod, createView } from '../utils.js';

var fdLockSet = mixin({
  fdLockSet(fd, flockAddress, canWait) {
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EACCES, () => {
      const stream = this.getStream(fd);
      if (hasMethod(stream, 'setlock')) {
        const flock = createView(24);
        this.moveExternBytes(flock, flockAddress, false);
        const type = flock.getUint16(0, le);
        const whence = flock.getUint16(2, le);
        const pid = flock.getUint32(4, le);
        const start = flock.getBigUint64(8, le);
        const len = flock.getBigUint64(16, le);
        return stream.setlock({ type, whence, start, len, pid });
      } else {
        return true;
      }
    }, (set) => expectBoolean(set, PosixError.EACCES));
  },
});

export { fdLockSet as default };
