import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { hasMethod, createView } from '../utils.js';

var fdLockGet = mixin({
  fdLockGet(fd, flockAddress, canWait) {
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EACCES, () => {      
      const stream = this.getStream(fd);
      if (hasMethod(stream, 'getlock')) {
        const flock = createView(24);
        this.moveExternBytes(flock, flockAddress, false);
        const type = flock.getUint16(0, le);
        const whence = flock.getUint16(2, le);
        const pid = flock.getUint32(4, le);
        const start = flock.getBigInt64(8, le);
        const length = flock.getBigUint64(16, le);
        return stream.getlock({ type, whence, start, length, pid });
      } 
    }, (lock) => {
      let flock, err;
      if (lock) {
        // conflict
        flock = createView(24);
        flock.setUint16(0, lock.type ?? 0, le);
        flock.setUint16(2, lock.whence ?? 0, le);
        flock.setUint32(4, lock.pid ?? 0, le);
        flock.setBigInt64(8, lock.start ?? 0n, le);
        flock.setBigUint64(16, lock.length ?? 0n, le);
        err = PosixError.EACCES;
      } else {
        // change type to unlock (2)
        flock = createView(2);
        flock.setUint16(0, 2, le);
        err = PosixError.NONE;
      }
      this.moveExternBytes(flock, flockAddress, true);
      return err;
    });
  },
});

export { fdLockGet as default };
