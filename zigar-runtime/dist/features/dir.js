import { mixin } from '../environment.js';

var dir = mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
      return arg;
    }
    const fd = this.createStreamHandle(arg, 'readdir');
    return { fd };
  },
});

export { dir as default };
