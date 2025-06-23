import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  wasi_fd_prestat_get(fd, buf_address) {
    if (fd === 3) {
      // descriptor 3 is the root directory, I think
      const dv = new DataView(this.memory.buffer);
      dv.setUint8(buf_address, 0);
      dv.setUint32(buf_address + 4, 0, true);
      return PosixError.NONE;
    } else {
      return PosixError.EBADF;
    }
  },
  wasi_fd_prestat_dir_name(fd, path_address, path_len) {
    return PosixError.NONE;
  }
}) : undefined;
