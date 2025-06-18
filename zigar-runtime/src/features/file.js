import { mixin } from '../environment.js';

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
    const handle = this.createStreamHandle(arg);
    return { handle };
  },
});