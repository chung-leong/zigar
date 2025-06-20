import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var wasiPrestatGet = mixin({
  wasi_fd_prestat_get() {
    return PosixError.EBADF;
  }
}) ;

export { wasiPrestatGet as default };
