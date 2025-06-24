import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  wasi_fd_tell(fd, newoffset_ptr, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => this.getStreamPointer(fd), (pos) => {
      const dv = new DataView(this.memory.buffer);
      dv.setBigUint64(newoffset_ptr, pos, true);
    });
  }
}) : undefined;
