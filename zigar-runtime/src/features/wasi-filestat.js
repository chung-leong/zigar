import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { showPosixError, TypeMismatch } from '../errors.js';
import { decodeFlags, decodeText, isPromise } from '../utils.js';

const LookupFlag = {
  symlinkFollow: 1 << 0,
};

export default mixin({
  wasi_fd_filestat_get(fd, buf_address, canWait = false) {
    const path = this.wasi.pathMap?.get?.(fd);
    if (path) {
      try {
        return this.wasiGetStat(path, {}, buf_address, canWait);
      } catch (err) {        
        if (err.code !== PosixError.ENOENT) throw err;
      }
    }
    const stream = this.getStream(fd);
    return this.wasiCopyStat({ size: stream.size }, buf_address);
  },
  wasi_path_filestat_get(fd, flags, path_address, path_len, buf_address, canWait = false) {
    const pathArray = this.obtainZigArray(path_address, path_len);
    const path = decodeText(pathArray);
    return this.wasiGetStat(path, decodeFlags(flags, LookupFlag), buf_address, canWait)
  },
  wasiGetStat(path, flags, buf_address, canWait) {
    const done = (stat) => this.wasiCopyStat(stat, buf_address);
    try {
      const result = this.triggerEvent('stat', { path, flags }, PosixError.ENOENT);
      if (isPromise(result)) {
        if (!canWait) {
          throw new Deadlock();
        }
        return result.then(done, showPosixError);
      }
      return done(result);
    } catch (err) {
      return showPosixError(err);
    }
  },
  wasiCopyStat(stat, buf_address) {
    if (stat === false) {
      return PosixError.ENOENT;
    }
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
    return PosixError.NONE;
  }
});
