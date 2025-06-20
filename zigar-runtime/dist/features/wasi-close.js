import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var wasiClose = mixin({
  wasi_fd_close(fd) {
    this.closeStream(fd);
    return PosixError.NONE;
  }
});

export { wasiClose as default };
