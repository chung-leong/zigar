import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';

export default mixin({
  pathCreateDirectory(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('mkdir', loc, PosixError.ENOENT);
    }, (result) => {
      if (result instanceof Map) return;
      if (result === true) return PosixError.EEXIST; 
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('boolean', result);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathCreateDirectory: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
