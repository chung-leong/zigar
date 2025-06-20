import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  wasi_fd_close(fd) {
    this.closeStream(fd);
    return PosixError.NONE;
  }
});
