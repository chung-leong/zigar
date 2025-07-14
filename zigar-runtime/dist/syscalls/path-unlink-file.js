import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';

var pathUnlinkFile = mixin({
  pathUnlinkFile(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('unlink', loc, PosixError.ENOENT);
    }, (result) => expectBoolean(result, PosixError.ENOENT));
  },
});

export { pathUnlinkFile as default };
