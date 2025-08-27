import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue } from '../errors.js';
import { isPromise, createView, encodeText, getEnumNumber } from '../utils.js';
import './copy-int.js';

var fdReaddir = mixin({
  fdReaddir(fd, bufAddress, bufLen, cookie, bufusedAddress, canWait) {
    if (bufLen < 24) {
      return PosixError.EINVAL;
    }
    let dir, async;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      [ dir ] = this.getStream(fd);
      {
        return dir.seek(cookie);
      }
    }, (pos) => catchPosixError(canWait, PosixError.EBADF, () => {      
      cookie = pos;
      // retrieve the first entry, checking if the call is async
      const result = dir.readdir();
      async = isPromise(result);
      return result;
    }, (dent) => {
      const dv = createView(bufLen);
      let remaining = bufLen;
      let p = 0;
      while (dent) {
        const { name, type = 'unknown', ino = 0 } = dent;
        const nameArray = encodeText(name);
        const typeIndex = getEnumNumber(type, PosixFileType);
        if (typeIndex === undefined) {
          throw new InvalidEnumValue(PosixFileType, type);
        }
        if (remaining < 24 + nameArray.length) {
          break;
        }
        dv.setBigUint64(p, BigInt(++cookie), true);
        dv.setBigUint64(p + 8, BigInt(ino), true);
        dv.setUint32(p + 16, nameArray.length, true);
        dv.setUint8(p + 20, typeIndex);
        p += 24;
        remaining -= 24;
        for (let i = 0; i < nameArray.length; i++, p++) {
          dv.setUint8(p, nameArray[i]);
        }
        remaining -= nameArray.length;
        // get next entry if call is sync
        dent = (remaining > 24 + 16 && async) ? dir.readdir() : null;
      }
      this.moveExternBytes(dv, bufAddress, true);
      this.copyUint32(bufusedAddress, p);
    }));
  },
});

export { fdReaddir as default };
