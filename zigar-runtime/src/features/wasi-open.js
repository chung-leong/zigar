import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText } from '../utils.js';

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
  wasi_path_open(dirfd, dirflags, path_address, path_len, oflags, fs_rights_base, fs_rights_inheriting, fs_flags, fd_address) {
    const pathArray = this.obtainZigArray(path_address, path_len);
    const path = decodeText(pathArray);
    const mode = (fs_rights_base & Right.read)
    ? (fs_rights_base & Right.write)
      ? 'readWrite'
      : 'readOnly'
    : (fs_rights_base & Right.write)
      ? 'writeOnly'
      : '';
    const flags = {};
    for (const [ name, value ] of Object.entries(OpenFlag)) {
      if (oflags & value) {
        flags[name] = true;
      }
    }
    const { open } = this.listeners;
    if (!open) {
      console.error(`No listener for event 'open'`);
      return PosixError.ENOENT;
    }
    const arg = open({ path, mode, flags });
    const handle = this.createStreamHandle(arg);
    const dv = this.obtainZigView(fd_address, 4);
    dv.setUint32(0, handle, true);
    return PosixError.NONE;
  }
});
