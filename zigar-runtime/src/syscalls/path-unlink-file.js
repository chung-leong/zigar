import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';

export default mixin({
  pathUnlinkFile(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('unlink', loc, PosixError.ENOENT);
    }, (result) => expectBoolean(result, PosixError.ENOENT));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathUnlinkFile: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
