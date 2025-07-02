import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';

const OpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};

const Right = {
  read: 1n << 1n,
  write: 1n << 6n,
  readdir: 1n << 14n,
};

var streamOpen = mixin({
  pathOpen(dirfd, dirflags, pathAddress, pathLen, oflags, rightsBase, rightsInheriting, fsFlags, fdAddress, canWait) {
    const rights = decodeFlags(rightsBase | rightsInheriting, Right);
    const flags = decodeFlags(oflags, OpenFlag);
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirfd, pathAddress, pathLen);
      return this.triggerEvent('open', { ...loc, rights, flags }, PosixError.ENOENT);
    }, (arg) => {
      if (arg === false) {
        return PosixError.ENOENT;
      }
      let resource;
      if (rights.read || Object.values(flags).length === 0) {
        resource = this.convertReader(arg);
      } else if (rights.write) {
        resource = this.convertWriter(arg);
      } else if (rights.readdir) {
        resource = this.convertDirectory(arg);
      }
      const handle = this.createStreamHandle(resource);
      this.setStreamLocation?.(handle, loc);
      const fdDV = createView(4);
      fdDV.setUint32(0, this.littleEndian);
      this.fillExternBytes(fdDV, fdAddress);
    });
  }  
});

export { streamOpen as default };
