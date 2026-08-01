import { PosixError, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidStream, checkStreamMethod } from '../errors.js';
import { safeInt } from '../utils.js';

var pathFilestatSetSize = mixin({
  pathFilestatSetSize(dirFd, pathAddress, pathLen, newSize, canWait) {
    return catchPosixError(canWait, PosixError.EPERM, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const rights = { write: true };
      const flags = {
        exclusive: true,
        sync: true,
      };
      return this.triggerEvent('open', { ...loc, rights, flags });
    }, (openResult) => {
        if (openResult === undefined) {
          return PosixError.ENOTSUP;
        } else if (openResult === false) {
          return PosixError.ENOENT;
        }
        const stream = this.convertWriter(openResult);
        if (!stream) {
          throw new InvalidStream(PosixDescriptorRight.fd_write, openResult);
        }
        checkStreamMethod(stream, 'truncate', PosixError.EINVAL);
        return stream.truncate(safeInt(newSize));
    });
  },
});

export { pathFilestatSetSize as default };
