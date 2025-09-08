import { PosixError, PosixLookupFlag, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidStream } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-stat.js';

var pathFilestatGet = mixin({
  pathFilestatGetEvent: 'stat/open',
  pathFilestatGet(dirFd, lFlags, pathAddress, pathLen, bufAddress, canWait) {
    let infer = false;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      let flags = {
        ...decodeFlags(lFlags, PosixLookupFlag),
      };
      if (this.hasListener('stat')) {
        return this.triggerEvent('stat', { ...loc, flags });
      } else {
        flags = { ...flags, dryrun: true };
        infer = true;
        return this.triggerEvent('open', { ...loc, rights: {}, flags });
      }
    }, (result) => {
      if (result === undefined) {
        return PosixError.ENOTSUP;
      } else if (result === false) {
        return PosixError.ENOENT;
      }
      if (infer) {
        const stream = this.convertReader(result) ?? this.convertWriter(result) ?? this.convertDirectory(result);
        if (!stream) {
          throw new InvalidStream(PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write | PosixDescriptorRight.fd_readdir, arg);
        }
        result = this.inferStat(stream);
      }
      return this.copyStat(bufAddress, result);
    });
  },
});

export { pathFilestatGet as default };
