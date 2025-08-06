import { PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';

export default mixin({
  fdFdstatSetFlags(fd, flags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights ] = entry;
      if (flags & PosixDescriptorFlag.nonblock) {
        if (rights & PosixDescriptorRight.fd_read) {
          checkStreamMethod(stream, 'readnb');
        }
        if (rights & PosixDescriptorRight.fd_write) {
          checkStreamMethod(stream, 'writenb');
        }
      }
      entry[2] = flags;
    });    
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdFdstatSetFlags: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
