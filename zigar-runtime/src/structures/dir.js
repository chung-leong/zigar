import { PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
      return arg;
    }
    const dir = this.convertDirectory(arg);
    const fdRights = PosixDescriptorRight.fd_readdir
                   | PosixDescriptorRight.fd_seek
                   | PosixDescriptorRight.fd_tell
                   | PosixDescriptorRight.fd_filestat_get 
                   | PosixDescriptorRight.fd_filestat_set_times;
    const fd = this.createStreamHandle(dir, fdRights);
    return { fd };
  },
});
