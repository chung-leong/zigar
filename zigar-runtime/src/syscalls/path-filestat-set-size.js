import { PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod, InvalidStream } from '../errors.js';
import { isPromise, safeInt } from '../utils.js';

export default mixin({
  pathFilestatSetSize(dirFd, pathAddress, pathLen, newSize, canWait) {
    return catchPosixError(canWait, PosixError.EPERM, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const rights = { write: true };
      const flags = {
        exclusive: true,
        sync: true,
      };
      const truncate = (arg) => {
        if (arg === undefined) {
          return PosixError.ENOTSUP;
        } else if (arg === false) {
          return PosixError.ENOENT;
        }
        const stream = this.convertWriter(arg);
        if (!stream) {
          throw new InvalidStream(PosixDescriptorRight.write, arg);
        }
        checkStreamMethod(stream, 'truncate', PosixError.EINVAL);
        return stream.truncate(safeInt(newSize));
      };
      const openResult = this.triggerEvent('open', { ...loc, rights, flags });
      if (isPromise(openResult)) {
        return openResult.then(truncate);
      } else {
        return truncate(openResult);
      }
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathFilestatSetSize: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
