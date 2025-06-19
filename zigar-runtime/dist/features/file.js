import { mixin } from '../environment.js';

var file = mixin({
  // create File struct for outbound call
  createFile(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.handle) === 'number') {
      return arg;
    }
    const handle = this.createStreamHandle(arg);
    return { handle };
  },
});

export { file as default };
