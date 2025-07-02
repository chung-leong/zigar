import { mixin } from '../environment.js';

export default mixin({
  fdSeek(fd, offset, whence, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const reader = this.getStream(fd, 'seek');
      return reader.seek(offset, whence);
    }, (pos) => {
      const offsetDV = createView(8);
      offsetDV.setBigUint64(0, BigInt(pos), this.littleEndian);
      this.moveExternBytes(offsetDV, newOffsetAddress, true); 
    });
  },
});
