import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidFileDescriptor } from '../errors.js';

export default mixin({
  fdFdstatSetRights(fd, newRights, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights ] = entry;
      if (newRights & ~rights) {
        // rights can only be removed, not added
        throw new InvalidFileDescriptor();
      }
      entry[1] = rights;
    });    
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdFdstatSetRights: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
