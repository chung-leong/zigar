import { PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidStream } from '../errors.js';
import '../utils.js';

var dir = mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.handle) === 'number') {
      return arg;
    }
    const dir = this.convertDirectory(arg);
    if (!dir) {
      throw new InvalidStream(PosixDescriptorRight.fd_readdir, arg);
    }
    let handle = this.createStreamHandle(dir, this.getDefaultRights('dir'));
    return { handle };
  },
});

export { dir as default };
