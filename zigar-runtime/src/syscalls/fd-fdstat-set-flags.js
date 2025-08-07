import { PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';

export default mixin({
  fdFdstatSetFlags(fd, newFlags, canWait) {
    // only these flags can be changed
    const mask = PosixDescriptorFlag.append | PosixDescriptorFlag.nonblock;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights, flags ] = entry;
      if (newFlags & PosixDescriptorFlag.nonblock) {
        if (rights & PosixDescriptorRight.fd_read) {
          checkStreamMethod(stream, 'readnb');
        }
        if (rights & PosixDescriptorRight.fd_write) {
          checkStreamMethod(stream, 'writenb');
        }
      }
      entry[2] = (flags & ~mask) | (newFlags & mask);
    });    
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdFdstatSetFlags: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
