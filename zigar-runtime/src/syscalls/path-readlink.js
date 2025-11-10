import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, TypeMismatch } from '../errors.js';
import { encodeText } from '../utils.js';
import './copy-int.js';

export default mixin({
  pathReadlinkEvent: 'readlink',
  pathReadlink(dirFd, pathAddress, pathLen, bufAddress, bufLen, writtenAddress, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('readlink', loc, PosixError.ENOENT);
    }, (result) => {
      if (result === undefined) return PosixError.ENOTSUP;
      if (result === false) return PosixError.ENOENT;
      if (typeof(result) !== 'string') throw new TypeMismatch('string', result);
      const ta = encodeText(result).slice(0, bufLen);
      this.moveExternBytes(ta, bufAddress, this.littleEndian);
      this.copyUint32(writtenAddress, ta.length);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathReadlink: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
