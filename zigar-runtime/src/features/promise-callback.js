import { mixin } from '../environment.js';
import { FINALIZE, PROMISE } from '../symbols.js';

export default mixin({
  createCallback(args, callback) {
    if (!callback) {
      let resolve, reject;
      args[PROMISE] = new Promise((...args) => {
        resolve = args[0];
        reject = args[1];
      });
      callback = (value) => {
        const f = (value instanceof Error) ? reject : resolve;
        f(value);
      };
    }
    return (result) => {
      if (!(result instanceof Error)) {
        args[FINALIZE]();
      }
      return callback(result);
    }
  },
});