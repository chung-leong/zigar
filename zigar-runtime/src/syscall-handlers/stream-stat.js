import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue, TypeMismatch } from '../errors.js';
import { decodeEnum, decodeFlags } from '../utils.js';

const LookupFlag = {
  symlinkFollow: 1 << 0,
};

export default mixin({
  fdFilestatGet(fd, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const loc = this.getStreamLocation?.(fd);
      if (loc) {
        try {
          return this.triggerEvent('stat', { ...loc, flags: {} }, PosixError.ENOENT);
        } catch (err) {        
          if (err.code !== PosixError.ENOENT) {
            throw err;
          }
        }
      }
      const stream = this.getStream(fd);
      return { size: stream.size, type: 'file' };
    }, (stat) => this.copyStat(stat, bufAddress));
  },
  pathFilestatGet(dirfd, lookupFlags, pathAddress, pathLen, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, pathAddress, pathLen);
      const flags = decodeFlags(lookupFlags, LookupFlag);
      return this.triggerEvent('stat', { ...loc, flags }, PosixError.ENOENT);
    }, (stat) => this.copyStat(stat, bufAddress));
  },
  copyStat(stat, bufAddress) {
    if (stat === false) {
      return PosixError.ENOENT;
    }
    if (typeof(stat) !== 'object' || !stat) {
      throw new TypeMismatch('object or false', stat);
    }
    const type = decodeEnum(stat.type);
    if (type === undefined) {
      if (stat.type) {
        throw new InvalidEnumValue(PosixFileType, stat.type);
      }
      type = PosixFileType.unknown;
    }
    const buf = createView(size);    
    buf.setBigUint64(0, 0n, true);  // dev
    buf.setBigUint64(8, 0n, true);  // ino
    buf.setUint8(16, type); // filetype
    buf.setBigUint64(24, 0n, true);  // nlink
    buf.setBigUint64(32, BigInt(stat.size ?? 0), true);
    buf.setBigUint64(40, BigInt(stat.atime ?? 0), true);
    buf.setBigUint64(48, BigInt(stat.mtime ?? 0), true);
    buf.setBigUint64(56, BigInt(stat.ctime ?? 0), true);
    this.moveExternBytes(buf, bufAddress, true);
  },
});
