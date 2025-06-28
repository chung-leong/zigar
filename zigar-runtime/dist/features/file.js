import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';

var file = mixin({
  // create File struct for outbound call
  createFile(arg) {
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

export { file as default };
