import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch, InvalidEnumValue } from '../errors.js';
import { getEnumNumber, createView } from '../utils.js';

var copyStat = mixin({
  copyStat(bufAddress, stat) {
    if (stat === false) {
      return PosixError.ENOENT;
    }
    if (typeof(stat) !== 'object' || !stat) {
      throw new TypeMismatch('object or false', stat);
    }
    let type = getEnumNumber(stat.type, PosixFileType);
    if (type === undefined) {
      if (stat.type) {
        throw new InvalidEnumValue(PosixFileType, stat.type);
      }
      type = PosixFileType.unknown;
    }
    const le = this.littleEndian;
    const buf = createView(64);
    buf.setBigUint64(0, 0n, le);  // dev
    buf.setBigUint64(8, 0n, le);  // ino
    buf.setUint8(16, type); // filetype
    buf.setBigUint64(24, 0n, le);  // nlink
    buf.setBigUint64(32, BigInt(stat.size ?? 0), le);
    buf.setBigUint64(40, BigInt(stat.atime ?? 0), le);
    buf.setBigUint64(48, BigInt(stat.mtime ?? 0), le);
    buf.setBigUint64(56, BigInt(stat.ctime ?? 0), le);
    this.moveExternBytes(buf, bufAddress, le);
  }
});

export { copyStat as default };
