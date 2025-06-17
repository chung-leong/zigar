import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  wasi_fd_prestat_get() {
    return PosixError.EBADF;
  }
});
