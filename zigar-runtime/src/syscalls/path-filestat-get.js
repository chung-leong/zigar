import { PosixError, PosixLookupFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-stat.js';

export default mixin({
  pathFilestatGet(dirFd, lFlags, pathAddress, pathLen, bufAddress, canWait) {
    let infer = false;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const flags = {
        ...decodeFlags(lFlags, PosixLookupFlag),
        dryrun: true,
      };
      if (this.hasListener('stat')) {
        return this.triggerEvent('stat', { ...loc, flags }, PosixError.ENOENT);
      } else {
        infer = true;
        return this.triggerEvent('open', { ...loc, rights: {}, flags }, PosixError.ENOENT);
      }
    }, (arg) => {
      let stat;
      if (infer) {
        let stream;
        try {
          stream = this.convertReader(arg);
        } catch {
          try {
            stream = this.convertWriter(arg);
          } catch {
            stream = this.convertDirectory(arg);
          }
        }
        stat = this.inferStat(stream);
      } else {
        stat = arg;
      }
      return this.copyStat(bufAddress, stat);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathFilestatGet: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
