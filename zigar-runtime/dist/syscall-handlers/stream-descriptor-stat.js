import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue } from '../errors.js';
import { hasMethod, decodeEnum } from '../utils.js';

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

var streamDescriptorStat = mixin({
  fdFdstatGet(fd, buf_address, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const dv = new DataView(this.memory.buffer);
      const stream = this.getStream(fd);
      let rights = 0, flags = 0, type;
      rights = Right.fd_filestat_get;
      if (this.listenerMap.get('set_times') && this.getStreamLocation?.(fd)) {
        rights |= Right.fd_filestat_set_times;
      }
      for (const name of [ 'read', 'write', 'seek', 'tell', 'advise', 'allocate', 'datasync', 'sync', 'readdir' ]) {
        if (hasMethod(stream, name)) {
          rights |= Right[`fd_${name}`];
        }
      }
      if (stream.type) {
        type = decodeEnum(stream.type, PosixFileType);
        if (type === undefined) {
          throw new InvalidEnumValue(PosixFileType, stream.type);
        }
      } else {
        if (rights & (Right.fd_read | Right.fd_write)) {
          type = PosixFileType.file;
        } else {
          type = PosixFileType.directory;
        }
      }
      if (type === PosixFileType.directory) {
        rights |= Right.path_open | Right.path_filestat_get;
      }
      dv.setUint8(buf_address + 0, type);
      dv.setUint16(buf_address + 2, flags, true);
      dv.setBigUint64(buf_address + 8, BigInt(rights), true);
      dv.setBigUint64(buf_address + 16, 0n, true);
    });
  },
});

export { streamDescriptorStat as default };
