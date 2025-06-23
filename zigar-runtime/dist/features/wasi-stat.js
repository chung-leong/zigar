import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText } from '../utils.js';

var wasiStat = mixin({
  wasi_fd_fdstat_get(fd, buf_address, canWait = false) {
    console.error({ fd, buf_address });
    return PosixError.NONE;
  },
  wasi_fd_filestat_get(fd, buf_address, canWait = false) {

  },
  wasi_path_filestat_get(fd, flags, path_address, path_len, buf_address, canWait = false) {
    new DataView(this.memory.buffer);
    const pathArray = this.obtainZigArray(path_address, path_len);
    const path = decodeText(pathArray);
    console.log(`path_filestat_get: ${path} ${flags}`);
    return PosixError.NONE;
  }
});

export { wasiStat as default };
