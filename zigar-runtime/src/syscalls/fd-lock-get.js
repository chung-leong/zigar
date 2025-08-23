import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView, hasMethod, safeInt } from '../utils.js';

export default mixin({
  fdLockGet(fd, flockAddress, canWait) {
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EACCES, () => {      
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'getlock')) {
        const flock = createView(24);
        this.moveExternBytes(flock, flockAddress, false);
        const type = flock.getUint16(0, le);
        const whence = flock.getUint16(2, le);
        const pid = flock.getUint32(4, le);
        const start = safeInt(flock.getBigInt64(8, le));
        const length = safeInt(flock.getBigUint64(16, le));
        return stream.getlock({ type, whence, start, length, pid });
      } 
    }, (lock) => {
      let flock;
      if (lock) {
        // conflict
        flock = createView(24);
        flock.setUint16(0, lock.type ?? 0, le);
        flock.setUint16(2, lock.whence ?? 0, le);
        flock.setUint32(4, lock.pid ?? 0, le);
        flock.setBigInt64(8, BigInt(lock.start ?? 0), le);
        flock.setBigUint64(16, BigInt(lock.length ?? 0), le);
      } else {
        // change type to unlock (2)
        flock = createView(2);
        flock.setUint16(0, 2, le);
      }
      this.moveExternBytes(flock, flockAddress, true);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdLockGet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
