import { PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidStream } from '../errors.js';
import { hasMethod } from '../utils.js';

var file = mixin({
  // create File struct for outbound call
  createFile(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.handle) === 'number') {
      return arg;
    }
    const file = this.convertReader(arg) ?? this.convertWriter(arg);
    if (!file) {
      throw new InvalidStream(PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write, arg);
    } 
    const rights = this.getDefaultRights('file');
    const methodRights = {
      read: PosixDescriptorRight.fd_read,
      write: PosixDescriptorRight.fd_write,
      seek: PosixDescriptorRight.fd_seek,
      tell: PosixDescriptorRight.fd_tell,
      allocate: PosixDescriptorRight.fd_allocate,
    };
    // remove rights to actions that can't be performed
    for (const [ name, right ] of Object.entries(methodRights)) {
      if (!hasMethod(file, name)) {
        rights[0] &= ~right;
      }
    }
    let fd = this.createStreamHandle(file, rights);
    return { handle: fd };
  },
});

export { file as default };
