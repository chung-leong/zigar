import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

var seek = mixin({
  wasi_fd_seek(fd, offset, whence, newoffset_ptr, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => this.changeStreamPointer(fd, offset, whence), (pos) => {
      const dv = new DataView(this.memory.buffer);
      dv.setBigUint64(newoffset_ptr, pos, true);
    });
  },
});

export { seek as default };
