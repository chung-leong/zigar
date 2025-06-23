import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { showPosixError } from '../errors.js';
import { decodeText, isPromise } from '../utils.js';

var mkdir = mixin({
  wasi_path_create_directory(fd, path_address, path_len) {
    const pathArray = this.obtainZigArray(path_address, path_len);
    const path = decodeText(pathArray);
    const done = (succeeded) => succeeded ? PosixError.NONE : PosixError.ENOENT;
    try {
      const result = this.triggerEvent('mkdir', { path }, PosixError.ENOENT);
      if (isPromise(result)) {
        return result.then(done, showPosixError);
      } else {
        return done(result);
      }
    } catch (err) {
      return showPosixError(err);
    }
  }
});

export { mkdir as default };
