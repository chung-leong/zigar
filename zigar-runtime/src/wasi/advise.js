import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

const Advice = {
  normal: 0,
  sequential: 1,
  random: 2,
  willNeed: 3,
  dontNeed: 4,
  noReuse: 5,
};

export default mixin({
  wasi_fd_advise(fd, offset, len, advice, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const stream = this.getStream(fd);
      const adviceKeys = Object.keys(Advice);
      return stream.advise?.(offset, len, adviceKeys[advice]);
    });
  }
});
