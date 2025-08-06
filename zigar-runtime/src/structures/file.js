import { PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  // create File struct for outbound call
  createFile(arg) {
    if (process.env.TARGET === 'node') {
      if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
        return { handle: arg.fd  };
      }
    }
    if (typeof(arg) === 'object' && typeof(arg?.handle) === 'number') {
      return arg;
    }
    let file;
    let fdRights = PosixDescriptorRight.fd_filestat_get 
                 | PosixDescriptorRight.fd_seek
                 | PosixDescriptorRight.fd_tell
                 | PosixDescriptorRight.fd_advise
                 | PosixDescriptorRight.fd_filestat_set_times;
    try {
      file = this.convertReader(arg);
      fdRights |= PosixDescriptorRight.fd_read;
    } catch (err) {
      try {
        file = this.convertWriter(arg);
        fdRights |= PosixDescriptorRight.fd_write
                  | PosixDescriptorRight.fd_sync
                  | PosixDescriptorRight.fd_datasync
                  | PosixDescriptorRight.fd_allocate
                  | PosixDescriptorRight.fd_filestat_set_size;
      } catch {
        throw err;
      }
    }
    const handle = this.createStreamHandle(file, fdRights);
    return { handle };
  },
});