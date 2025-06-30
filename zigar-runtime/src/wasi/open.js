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
    const fs_rights = fs_rights_base | fs_rights_inheriting;
    const loc = this.obtainStreamLocation(dirfd, path_address, path_len);
    const rights = decodeFlags(fs_rights, Right);
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const flags = decodeFlags(oflags, OpenFlag);
      return this.triggerEvent('open', { ...loc, rights, flags }, PosixError.ENOENT);
    }, (arg) => {
      if (arg === false) {
        return PosixError.ENOENT;
      }
      let resource;
      if (rights.read || fs_rights === 0) {
        resource = this.convertReader(arg);
      } else if (rights.write) {
        resource = this.convertWriter(arg);
      } else if (rights.readdir) {
        resource = this.convertDirectory(arg);
      }
      const handle = this.createStreamHandle(resource);
      this.setStreamLocation?.(handle, loc);
      const dv = new DataView(this.memory.buffer);
      dv.setUint32(fd_address, handle, true);
    });
  },
});
