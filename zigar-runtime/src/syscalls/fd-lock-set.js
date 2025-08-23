import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';
import { createView, hasMethod, safeInt } from '../utils.js';

export default mixin({
  fdLockSet(fd, flockAddress, wait, canWait) {
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EAGAIN, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'setlock')) {
        const flock = createView(24);
        this.moveExternBytes(flock, flockAddress, false);
        const type = flock.getUint16(0, le);
        const whence = flock.getUint16(2, le);
        const pid = flock.getUint32(4, le);
        const start = safeInt(flock.getBigUint64(8, le));
        const len = safeInt(flock.getBigUint64(16, le));
        return stream.setlock({ type, whence, start, len, pid }, wait);
      } else {
        return true;
      }
    }, (set) => expectBoolean(set, PosixError.EAGAIN));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdLockSet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
