import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  fdPrestatDirName(fd, path_address, path_len) {
    return PosixError.NONE;
  }
}) : undefined;
