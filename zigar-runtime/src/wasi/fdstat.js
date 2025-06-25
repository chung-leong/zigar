import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

const Right = {
    fd_datasync: 1 << 0,
    fd_read: 1 << 1,
    fd_seek: 1 << 2,
    fd_fdstat_set_flags: 1 << 3,
    fd_sync: 1 << 4,
    fd_tell: 1 << 5,
    fd_write: 1 << 6,
    fd_advise: 1 << 7,
    fd_allocate: 1 << 8,
    path_create_directory: 1 << 9,
    path_create_file: 1 << 10,
    path_link_source: 1 << 11,
    path_link_target: 1 << 12,
    path_open: 1 << 13,
    fd_readdir: 1 << 14,
    path_readlink: 1 << 15,
    path_rename_source: 1 << 16,
    path_rename_target: 1 << 17,
    path_filestat_get: 1 << 18,
    path_filestat_set_size: 1 << 19,
    path_filestat_set_times: 1 << 20,
    fd_filestat_get: 1 << 21,
    fd_filestat_set_size: 1 << 22,
    fd_filestat_set_times: 1 << 23,
    path_symlink: 1 << 24,
    path_remove_directory: 1 << 25,
    path_unlink_file: 1 << 26,
    poll_fd_readwrite: 1 << 27,
    sock_shutdown: 1 << 28,
    sock_accept: 1 << 29,
};

export default mixin({
  wasi_fd_fdstat_get(fd, buf_address, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const dv = new DataView(this.memory.buffer);
      let type, flags = 0, rights;
      if (fd === 3) {
        type = 3;  // dir
        rights = Right.path_open | Right.path_filestat_get;
      } else {        
        const stream = this.getStream(fd);
        type = 4; // file
        rights = Right.fd_filestat_get;
        if (this.listenerMap.get('set_times')) {
          rights |= Rights.fd_filestat_set_times;
        }
        for (const name of [ 'read', 'write', 'seek', 'tell', 'advise', 'allocate', 'datasync', 'sync', 'readdir' ]) {
          if (hasMethod(stream, name)) {
            rights |= Rights[`fd_${name}`];
          }
        }
      }
      dv.setUint8(buf_address + 0, type);
      dv.setUint16(buf_address + 2, flags);
      dv.setBigUint64(buf_address + 8, BigInt(rights));
      dv.setBigUint64(buf_address + 16, 0n);
    });
  },
});
