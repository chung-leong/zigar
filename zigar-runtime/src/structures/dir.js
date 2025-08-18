import { PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidStream } from '../errors.js';
import { usize } from '../utils.js';

export default mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
      return arg;
    }
    const dir = this.convertDirectory(arg);
    if (!dir) {
      throw new InvalidStream(PosixDescriptorRight.fd_readdir, arg);
    }
    const fdRights = PosixDescriptorRight.fd_readdir
                   | PosixDescriptorRight.fd_seek
                   | PosixDescriptorRight.fd_tell
                   | PosixDescriptorRight.fd_filestat_get 
                   | PosixDescriptorRight.fd_filestat_set_times;
    let fd = this.createStreamHandle(dir, fdRights);
    if (process.env.TARGET === 'node' && process.platform === 'win32') {
      // needs to be handle
      fd = this.obtainZigView(usize(fd << 1), 0);
    }
    return { fd };
  },
});
