import { PosixError, PosixLookupFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-stat.js';

export default mixin({
  pathFilestatGet(dirFd, lFlags, pathAddress, pathLen, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const flags = decodeFlags(lFlags, PosixLookupFlag);
      return this.triggerEvent('stat', { ...loc, flags }, PosixError.ENOENT);
    }, (stat) => this.copyStat(bufAddress, stat));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathFilestatGet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
