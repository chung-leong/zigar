import { PosixDescriptorRight, PosixError, PosixLookupFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidStream } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-stat.js';

export default mixin({
  pathFilestatGet(dirFd, lFlags, pathAddress, pathLen, bufAddress, canWait) {
    let infer = false;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      let flags = {
        ...decodeFlags(lFlags, PosixLookupFlag),
      };
      if (this.hasListener('stat')) {
        return this.triggerEvent('stat', { ...loc, flags }, PosixError.ENOENT);
      } else {
        flags = { ...flags, dryrun: true };
        infer = true;
        return this.triggerEvent('open', { ...loc, rights: {}, flags }, PosixError.ENOENT);
      }
    }, (arg) => {
      let stat;
      if (infer) {
        const stream = this.convertReader(arg) ?? this.convertWriter(arg) ?? this.convertDirectory(arg);
        if (!stream) {
          throw new InvalidStream(PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write | PosixDescriptorRight.fd_readdir, arg);
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
