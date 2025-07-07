import { PosixDescriptorRight, PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue } from '../errors.js';
import { createView, decodeEnum, hasMethod } from '../utils.js';

export default mixin({
  fdFdstatGet(fd, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      let rights = 0, flags = 0, type;
      rights = PosixDescriptorRight.fd_filestat_get;
      if (this.listenerMap.get('set_times') && this.getStreamLocation?.(fd)) {
        rights |= PosixDescriptorRight.fd_filestat_set_times;
      }
      for (const name of [ 'read', 'write', 'seek', 'tell', 'advise', 'allocate', 'datasync', 'sync', 'readdir' ]) {
        if (hasMethod(stream, name)) {
          rights |= PosixDescriptorRight[`fd_${name}`];
        }
      }
      if (stream.type) {
        type = decodeEnum(stream.type, PosixFileType);
        if (type === undefined) {
          throw new InvalidEnumValue(PosixFileType, stream.type);
        }
      } else {
        if (rights & (PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write)) {
          type = PosixFileType.file;
        } else {
          type = PosixFileType.directory;
        }
      }
      if (type === PosixFileType.directory) {
        rights |= PosixDescriptorRight.path_open | PosixDescriptorRight.path_filestat_get;
      }
      const dv = createView(24);
      dv.setUint8(0, type);
      dv.setUint16(2, flags, true);
      dv.setBigUint64(8, BigInt(rights), true);
      dv.setBigUint64(16, 0n, true);
      this.moveExternBytes(dv, bufAddress, true)
    });
  },
});
