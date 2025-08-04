import { PosixDescriptorRight, PosixDescriptorFlag, PosixOpenFlag, PosixLookupFlag, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-int.js';

const Right = {
  read: BigInt(PosixDescriptorRight.fd_read),
  write: BigInt(PosixDescriptorRight.fd_write),
  readdir: BigInt(PosixDescriptorRight.fd_readdir),
};

var pathOpen = mixin({
  pathOpen(dirFd, lFlags, pathAddress, pathLen, oFlags, rightsBase, rightsInheriting, fdFlags, fdAddress, canWait) {
    const rights = decodeFlags(rightsBase | rightsInheriting, Right);
    const flags = {
      ...decodeFlags(lFlags, PosixLookupFlag),
      ...decodeFlags(oFlags, PosixOpenFlag),
      ...decodeFlags(fdFlags, PosixDescriptorFlag),
    };
    let loc;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('open', { ...loc, rights, flags }, PosixError.ENOENT);
    }, (arg) => {
      if (arg === false) {
        return PosixError.ENOENT;
      }
      let resource;
      if (rights.read || Object.values(rights).length === 0) {
        resource = this.convertReader(arg);
      } else if (rights.write) {
        resource = this.convertWriter(arg);
      } else if (rights.readdir) {
        resource = this.convertDirectory(arg);
      }
      const fd = this.createStreamHandle(resource);
      this.setStreamLocation?.(fd, loc);
      this.copyUint32(fdAddress, fd);
    });
  },
});

export { pathOpen as default };
