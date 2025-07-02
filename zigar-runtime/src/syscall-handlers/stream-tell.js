import { mixin } from '../environment.js';

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
});
