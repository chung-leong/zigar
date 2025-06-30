import { mixin } from '../environment.js';

var dir = mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
      return arg;
    }
    const dir = this.convertDirectory(arg);
    const fd = this.createStreamHandle(dir);
    return { fd };
  },
});

export { dir as default };
