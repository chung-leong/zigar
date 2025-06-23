import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { showPosixError } from '../errors.js';
import { decodeFlags, decodeText, isPromise } from '../utils.js';

const OpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};

const Right = {
  read: 1n << 1n,
  write: 1n << 6n,
};

export default mixin({
  init() {
    this.wasi.pathMap = new Map();
  },
  wasi_path_open(dirfd, dirflags, path_address, path_len, oflags, fs_rights_base, fs_rights_inheriting, fs_flags, fd_address, canWait = false) {
    const dv = new DataView(this.memory.buffer);
    const pathArray = this.obtainZigArray(path_address, path_len);
    const path = decodeText(pathArray);
    const rights = decodeFlags(fs_rights_base, Right);
    const flags = decodeFlags(oflags, OpenFlag);
    const done = (arg) => {
      if (arg === false) return PosixError.ENOENT;
      const handle = this.createStreamHandle(arg);
      this.wasi.pathMap.set(handle, path);
      dv.setUint32(fd_address, handle, true);
      return PosixError.NONE;
    };
    try {
      const result = this.triggerEvent('open', { path, rights, flags }, PosixError.ENOENT);
      if (isPromise(result)) {
        if (!canWait) {
          throw new Deadlock();
        }
        return result.then(done, showPosixError);
      } else {
        return done(result);
      }
    } catch (err) {
      return showPosixError(err);
    }
  }
});
