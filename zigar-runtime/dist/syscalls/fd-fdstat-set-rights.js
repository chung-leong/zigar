import { PosixError, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidFileDescriptor, checkStreamMethod } from '../errors.js';

var fdFdstatSetRights = mixin({
  fdFdstatSetRights(fd, newRights, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights ] = entry;
      if (newRights & ~rights) {
        // rights can only be removed, not added
        throw new InvalidFileDescriptor();
      }
      if (rights & PosixDescriptorRight.fd_write) {
        checkStreamMethod(stream, 'write');
      }
      if (rights & PosixDescriptorRight.fd_read) {
        checkStreamMethod(stream, 'read');
      }
      if (rights & PosixDescriptorRight.fd_readdir) {
        checkStreamMethod(stream, 'readdir');
      }
      entry[1] = rights;
    });    
  },
});

export { fdFdstatSetRights as default };
