import { PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod } from '../errors.js';

export default mixin({
  fdFdstatSetRights(fd, rights, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream ] = entry;
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
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdFdstatSetRights: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
