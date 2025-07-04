import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var fdPrestatDirName = mixin({
  fdPrestatDirName(fd, path_address, path_len) {
    return PosixError.NONE;
  }
}) ;

export { fdPrestatDirName as default };
