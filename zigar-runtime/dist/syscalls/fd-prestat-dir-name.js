import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var fdPrestatDirName = mixin({
  fdPrestatDirName(fd, pathAddress, pathLen) {
    return PosixError.NONE;
  }
}) ;

export { fdPrestatDirName as default };
