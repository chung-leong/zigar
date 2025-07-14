import { PosixDescriptorRight, PosixLookupFlag, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { decodeFlags, hasMethod } from '../utils.js';

const Right = {
  read: BigInt(PosixDescriptorRight.fd_read),
  write: BigInt(PosixDescriptorRight.fd_write),
  readdir: BigInt(PosixDescriptorRight.fd_readdir),
};

var pathAccess = mixin({
  // not part of WASI
  pathAccess(dirFd, lFlags, pathAddress, pathLen, rightsBase, canWait) {
    const rights = decodeFlags(rightsBase, Right);
    const flags = { 
      ...decodeFlags(lFlags, PosixLookupFlag),
      accessCheck: true,
    };
    let loc;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('open', { ...loc, rights, flags }, PosixError.ENOENT);
    }, (arg) => {
      if (arg === false) {
        return PosixError.ENOENT;
      }
      try {
        let resource;
        if (rights.read) {
          resource = this.convertReader(arg);
        } else if (rights.write) {
          resource = this.convertWriter(arg);
        } else if (rights.readdir) {
          resource = this.convertDirectory(arg);
        }
        for (const name of Object.keys(rights)) {
          if (!hasMethod(resource, name)) {
            return PosixError.EACCES;
          }
        }
      } catch {
        return PosixError.EACCES;
      }
    });
  },
});

export { pathAccess as default };
