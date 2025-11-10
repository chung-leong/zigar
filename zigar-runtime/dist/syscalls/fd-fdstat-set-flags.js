import { PosixDescriptorFlag, PosixError, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';

var fdFdstatSetFlags = mixin({
  fdFdstatSetFlags(fd, newFlags, canWait) {
    // only these flags can be changed
    const mask = PosixDescriptorFlag.append | PosixDescriptorFlag.nonblock;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights, flags ] = entry;
      if (newFlags & PosixDescriptorFlag.nonblock) {
        if (rights[0] & PosixDescriptorRight.fd_read) {
          checkStreamMethod(stream, 'readnb', PosixError.EPERM);
        }
        if (rights[0] & PosixDescriptorRight.fd_write) {
          checkStreamMethod(stream, 'writenb', PosixError.EPERM);
        }
      }
      entry[2] = (flags & ~mask) | (newFlags & mask);
    });    
  },
});

export { fdFdstatSetFlags as default };
