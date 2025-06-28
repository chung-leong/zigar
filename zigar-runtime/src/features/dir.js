import { mixin } from '../environment.js';

export default mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
      return arg;
    }
    const fd = this.createStreamHandle(arg, 'readdir');
    return { fd };
  },
});