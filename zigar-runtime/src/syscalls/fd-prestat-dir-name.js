import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  fdPrestatDirName(fd, pathAddress, pathLen) {
    return PosixError.NONE;
  }
}) : undefined;
