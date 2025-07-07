import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { createView } from '../utils.js';

export default mixin({
  fdTell(fd, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const reader = this.getStream(fd, 'tell');
      return reader.tell();
    }, (pos) => {
      const offsetDV = createView(8);
      offsetDV.setBigUint64(0, BigInt(pos), this.littleEndian);
      this.moveExternBytes(offsetDV, newOffsetAddress, true); 
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdTell: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
