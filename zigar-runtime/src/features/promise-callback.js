import { mixin } from '../environment.js';
import { FINALIZE, FIXED, MEMORY, PROMISE } from '../symbols.js';

export default mixin({
  createCallback(args, structure, callback) {
    if (!callback) {
      let resolve, reject;
      args[PROMISE] = new Promise((...args) => {
        resolve = args[0];
        reject = args[1];
      });
      callback = (result) => {
        if (result?.[MEMORY]?.[FIXED]) {
          // the memory in the result object is stack memory, which will go bad after the function
          // returns; we need to copy the content into JavaScript memory
          result = new result.constructor(result);
        }
        const f = (result instanceof Error) ? reject : resolve;
        f(result);
      };
    }
    return (result) => {
      if (!(result instanceof Error)) {
        args[FINALIZE]();
      }
      return callback(result);
    };
  },
});