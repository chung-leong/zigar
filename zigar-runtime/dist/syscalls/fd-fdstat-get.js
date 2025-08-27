import { PosixError, PosixFileType, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue } from '../errors.js';
import { getEnumNumber, createView } from '../utils.js';

var fdFdstatGet = mixin({
  fdFdstatGet(fd, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream, rights, flags ] = this.getStream(fd);
      let type;
      if (stream.type) {
        type = getEnumNumber(stream.type, PosixFileType);
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
      const dv = createView(24);
      dv.setUint8(0, type);
      dv.setUint16(2, flags, true);
      dv.setBigUint64(8, BigInt(rights[0]), true);
      dv.setBigUint64(16, BigInt(rights[1]), true);
      this.moveExternBytes(dv, bufAddress, true);
    });
  },
});

export { fdFdstatGet as default };
