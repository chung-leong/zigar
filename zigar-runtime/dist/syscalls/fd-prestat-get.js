import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { createView } from '../utils.js';

var fdPrestatGet = mixin({
  fdPrestatGet(fd, bufAddress) {
    if (fd === 3) {
      // descriptor 3 is the root directory, I think
      const dv = createView(8);      
      dv.setUint8(0, 0);
      dv.setUint32(4, 0, this.littleEndian);
      this.moveExternBytes(dv, bufAddress, true);
      return PosixError.NONE;
    } else {
      return PosixError.EBADF;
    }
  },
  fdPrestatDirName(fd, path_address, path_len) {
    return PosixError.NONE;
  }
}) ;

export { fdPrestatGet as default };
