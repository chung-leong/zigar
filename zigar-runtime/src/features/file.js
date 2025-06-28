import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';

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
    let handle;
    for (const type of [ 'read', 'write' ]) {
      try {
        handle = this.createStreamHandle(arg, type);
      } catch {
      }     
    }
    if (!handle) {
      throw new TypeMismatch('reader or writer', arg);
    }
    return { handle };
  },
});