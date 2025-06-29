import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { decodeFlags } from '../utils.js';

const OpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};

const Right = {
  read: 1n << 1n,
  write: 1n << 6n,
  readdir: 1n << 14n,
};

export default mixin({
  wasi_path_open(dirfd, dirflags, path_address, path_len, oflags, fs_rights_base, fs_rights_inheriting, fs_flags, fd_address, canWait) {
    const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
    const rights = decodeFlags(fs_rights_base, Right);
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const flags = decodeFlags(oflags, OpenFlag);
      return this.triggerEvent('open', { ...loc, rights, flags }, PosixError.ENOENT);
    }, (arg) => {
      if (arg === false) {
        return PosixError.ENOENT;
      }
      let type = 'read';
      for (const name of Object.keys(Right)) {
        if (rights[name]) {
          type = name;
          break;
        }
      }
      const handle = this.createStreamHandle(arg, type);
      this.setStreamLocation?.(handle, loc);
      const dv = new DataView(this.memory.buffer);
      dv.setUint32(fd_address, handle, true);
    });
  },
});
