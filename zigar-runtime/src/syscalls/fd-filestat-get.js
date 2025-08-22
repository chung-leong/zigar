import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import './copy-stat.js';

export default mixin({
  fdFilestatGet(fd, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (this.hasListener('stat')) {
        const target = stream.valueOf();
        const loc = this.getStreamLocation?.(fd);
        return this.triggerEvent('stat', { ...loc, target, flags: {} });
      } else {
        return this.inferStat(stream);
      }
    }, (stat) => this.copyStat(bufAddress, stat));
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      fdFilestatGet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
