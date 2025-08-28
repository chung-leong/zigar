import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch, InvalidEnumValue } from '../errors.js';
import { hasMethod, getEnumNumber, createView } from '../utils.js';

var copyStat = mixin({
  copyStat(bufAddress, stat) {
    if (stat === false) {
      return PosixError.ENOENT;
    }
    if (typeof(stat) !== 'object' || !stat) {
      throw new TypeMismatch('object or false', stat);
    }
    const { ino = 1, type = 'unknown', size = 0, atime = 0, mtime = 0, ctime = 0 } = stat;
    const typeNum = getEnumNumber(type, PosixFileType);
    if (typeNum === undefined) {
      throw new InvalidEnumValue(PosixFileType, type);
    }
    const le = this.littleEndian;
    const buf = createView(64);
    buf.setBigUint64(0, 0n, le); // dev
    buf.setBigUint64(8, BigInt(ino), le);  
    buf.setUint8(16, typeNum);
    buf.setBigUint64(24, 1n, le);  // nlink
    buf.setBigUint64(32, BigInt(size), le);
    buf.setBigUint64(40, BigInt(atime), le);
    buf.setBigUint64(48, BigInt(mtime), le);
    buf.setBigUint64(56, BigInt(ctime), le);
    this.moveExternBytes(buf, bufAddress, le);
  },
  inferStat(stream) {
    if (!stream) return;
    return { 
      size: stream.size, 
      type: hasMethod(stream, 'readdir') ? 'directory' : 'file',
    };
  },
});

export { copyStat as default };
