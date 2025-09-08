import { PosixDescriptor, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { createView } from '../utils.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  fdPrestatGet(fd, bufAddress) {
    if (!this.customWASI?.wasiImport?.fd_prestat_get) {
      if (fd === 3) {
        // descriptor 3 is the root directory, I think
        this.streamMap.set(fd, this.streamMap.get(PosixDescriptor.root));
        const dv = createView(8);      
        dv.setUint8(0, 0);
        dv.setUint32(4, 0, this.littleEndian);
        this.moveExternBytes(dv, bufAddress, true);
        return 0;
      } else {
        return PosixError.EBADF;
      }
    } else {
      return PosixError.ENOTSUP;
    }
  },
}) : undefined;
