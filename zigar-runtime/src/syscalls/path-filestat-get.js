import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-stat.js';

const LookupFlag = {
  symlinkFollow: 1 << 0,
};

export default mixin({
  pathFilestatGet(dirfd, lookupFlags, pathAddress, pathLen, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, pathAddress, pathLen);
      const flags = decodeFlags(lookupFlags, LookupFlag);
      return this.triggerEvent('stat', { ...loc, flags }, PosixError.ENOENT);
    }, (stat) => this.copyStat(bufAddress, stat));
  },
});
