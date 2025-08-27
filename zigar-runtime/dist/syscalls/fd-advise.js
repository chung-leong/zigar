import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { hasMethod } from '../utils.js';

const Advice = {
  normal: 0,
  sequential: 1,
  random: 2,
  willNeed: 3,
  dontNeed: 4,
  noReuse: 5,
};

var fdAdvise = mixin({
  fdAdvise(fd, offset, len, advice, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'advise')) {
        const adviceKeys = Object.keys(Advice);
        return stream.advise?.(offset, len, adviceKeys[advice]);
      }
    });
  },
});

export { fdAdvise as default };
