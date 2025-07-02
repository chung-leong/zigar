import { mixin } from '../environment.js';

var directoryCreate = mixin({
  pathCreateDirectory(dirfd, path_address, path_len, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
      return this.triggerEvent('mkdir', loc, PosixError.ENOENT);
    }, (result) => {
      if (result instanceof Map) return;
      if (result === true) return PosixError.EEXIST;
      if (result === false) return PosixError.ENOENT;
      throw new TypeMismatch('map or boolean', result);
    });
  },
});

export { directoryCreate as default };
