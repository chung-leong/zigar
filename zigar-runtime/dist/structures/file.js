import { mixin } from '../environment.js';

var file = mixin({
  // create File struct for outbound call
  createFileStruct(arg) {
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

export { file as default };
