import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue } from '../errors.js';
import { createView, decodeEnum, encodeText, isPromise } from '../utils.js';
import './copy-int.js';

export default mixin({
  fdReaddir(fd, bufAddress, bufLen, cookie, bufusedAddress, canWait) {
    if (bufLen < 24) {
      return PosixError.EINVAL;
    }
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const dir = this.getStream(fd);
      if (process.env.TARGET === 'node') {
        // we don't get a cookie on the Node side
        if (cookie === 0n) {
          cookie = dir.tell();
        }
      } else {
        if (cookie !== dir.tell()) {
          cookie = dir.seek(cookie);
        }
      }
      const result = dir.readdir();      
      if (isPromise(result)) {
        // don't pass the dir object when call is async
        return result.then((dent) => [ dent ]);
      } else {
        return [ result, dir ];
      }
    }, ([ dent, dir ]) => {
      const dv = createView(bufLen);
      let remaining = bufLen;
      let p = 0;      
      while (dent) {
        const { name, type = 'unknown', ino = 0 } = dent;
        const nameArray = encodeText(name);
        const typeIndex = decodeEnum(type, PosixFileType);
        if (typeIndex === undefined) {
          throw new InvalidEnumValue(PosixFileType, type);
        }
        if (remaining < 24 + nameArray.length) {
          break;
        }
        dv.setBigUint64(p, ++cookie, true);
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
        dent = (remaining > 24 + 16 && dir) ? dir.readdir() : null;
      }
      this.moveExternBytes(dv, bufAddress, true);
      this.copyUsize(bufusedAddress, p);
    })
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdReaddir: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
