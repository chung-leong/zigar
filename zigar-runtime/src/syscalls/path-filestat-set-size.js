import { PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod, InvalidStream } from '../errors.js';
import { safeInt } from '../utils.js';

export default mixin({
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
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathFilestatSetSize: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
