import { mixin } from '../environment.js';

export default mixin({
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