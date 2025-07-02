import { mixin } from '../environment.js';

export default mixin({
  fdClose(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.setStreamLocation?.(fd); 
      return this.closeStream(fd);
    });
  }
});
