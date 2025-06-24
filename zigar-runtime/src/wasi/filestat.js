import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';
import { decodeFlags } from '../utils.js';

const LookupFlag = {
  symlinkFollow: 1 << 0,
};

export default mixin({
  wasi_fd_filestat_get(fd, buf_address, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const path = this.wasi.pathMap?.get?.(fd);
      if (path) {
        try {
          return this.triggerEvent('stat', { path, flags: {} }, PosixError.EBADF);
        } catch (err) {        
          if (err.code !== PosixError.ENOENT) throw err;
        }
      }
      const stream = this.getStream(fd);
      return { size: stream.size };
    }, (stat) => this.wasiCopyStat(stat, buf_address));
  },
  wasi_path_filestat_get(fd, lookup_flags, path_address, path_len, buf_address, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const path = this.obtainZigString(path_address, path_len);
      const flags = decodeFlags(lookup_flags, LookupFlag);
      return this.triggerEvent('stat', { path, flags }, PosixError.ENOENT);
    }, (stat) => this.wasiCopyStat(stat, buf_address));
  },
  wasiCopyStat(stat, buf_address) {
    if (stat === false) return PosixError.ENOENT;
    if (typeof(stat) !== 'object' || !stat) {
      throw new TypeMismatch('object', stat);
    }
    const dv = new DataView(this.memory.buffer);
    dv.setBigUint64(buf_address + 0, 0n, true);  // dev
    dv.setBigUint64(buf_address + 8, 0n, true);  // ino
    dv.setUint8(buf_address + 16, 4); // filetype = regular file
    dv.setBigUint64(buf_address + 24, 0n, true);  // nlink
    dv.setBigUint64(buf_address + 32, BigInt(stat.size ?? 0), true);
    dv.setBigUint64(buf_address + 40, BigInt(stat.atime ?? 0), true);
    dv.setBigUint64(buf_address + 48, BigInt(stat.mtime ?? 0), true);
    dv.setBigUint64(buf_address + 56, BigInt(stat.ctime ?? 0), true);
  }
});
