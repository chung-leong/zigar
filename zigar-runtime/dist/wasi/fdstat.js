import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

const Right = {
    path_open: 1 << 13,
    path_filestat_get: 1 << 18,
    fd_filestat_get: 1 << 21};

var fdstat = mixin({
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
        if (typeof(stream.read) === 'function') {
          rights |= Right.read;
        }
        if (typeof(stream.write) === 'function') {
          rights |= Right.write;
        }
        if (typeof(stream.seek) === 'function') {
          rights |= Right.seek;
        }
        if (typeof(stream.tell) === 'function') {
          rights |= Right.tell;
        }
      }
      dv.setUint8(buf_address + 0, type);
      dv.setUint16(buf_address + 2, flags);
      dv.setBigUint64(buf_address + 8, BigInt(rights));
      dv.setBigUint64(buf_address + 16, 0n);
    });
  },
});

export { fdstat as default };
