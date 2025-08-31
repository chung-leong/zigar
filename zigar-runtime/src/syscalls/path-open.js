import { PosixDescriptorFlag, PosixDescriptorRight, PosixError, PosixLookupFlag, PosixOpenFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidStream } from '../errors.js';
import { decodeFlags } from '../utils.js';
import './copy-int.js';

const Right = {
  read: PosixDescriptorRight.fd_read,
  write: PosixDescriptorRight.fd_write,
  readdir: PosixDescriptorRight.fd_readdir,
};

export default mixin({
  pathOpen(dirFd, lFlags, pathAddress, pathLen, oFlags, rightsBase, rightsInheriting, fdFlags, fdAddress, canWait) {
    const fdRights = [ Number(rightsBase), Number(rightsInheriting) ];
    if (!(fdRights[0] & PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write | PosixDescriptorRight.fd_readdir)) {
      fdRights[0] |= PosixDescriptorRight.fd_read;
    }
    let loc;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const rights = decodeFlags(fdRights[0], Right);
      const flags = {
        ...decodeFlags(lFlags, PosixLookupFlag),
        ...decodeFlags(oFlags, PosixOpenFlag),
        ...decodeFlags(fdFlags, PosixDescriptorFlag),
      };
      return this.triggerEvent('open', { ...loc, rights, flags });
    }, (arg) => {
      if (arg === undefined) {
        return -PosixError.ENOTSUP;
      } else if (arg === false) {
        return -PosixError.ENOENT;
      }
      const stream = this.convertReader(arg) ?? this.convertWriter(arg) ?? this.convertDirectory(arg);
      if (!stream) {
        throw new InvalidStream(fdRights[0], arg);
      }
      const fd = this.createStreamHandle(stream, fdRights, fdFlags);
      this.setStreamLocation?.(fd, loc);
      this.copyUint32(fdAddress, fd);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pathOpen: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});
