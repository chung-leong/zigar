import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, expectBoolean } from '../errors.js';

var pathRename = mixin({
  pathRenameEvent: 'rename',
  pathRename(oldDirFd, oldPathAddress, oldPathLen, newDirFd, newPathAddress, newPathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(oldDirFd, oldPathAddress, oldPathLen);
      const { 
        path: newPath, 
        parent: newParent,
      } = this.obtainStreamLocation(newDirFd, newPathAddress, newPathLen);
      return this.triggerEvent('rename', { ...loc, newParent, newPath }, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

export { pathRename as default };
