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
    let file;
    try {
      file = this.convertReader(arg);
    } catch (err) {
      try {
        file = this.convertWriter(arg);
      } catch {
        throw err;
      }
    }
    const handle = this.createStreamHandle(file);
    return { handle };
  },
});