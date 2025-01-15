import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { PROMISE, MEMORY, ZIG, CALLBACK, FINALIZE } from '../symbols.js';

var promiseCallback = mixin({
  createPromiseCallback(args, func) {
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      args[PROMISE] = new Promise((resolve, reject) => {
        func = (result) => {
          if (result?.[MEMORY]?.[ZIG]) {
            // the memory in the result object is stack memory, which will go bad after the function
            // returns; we need to copy the content into JavaScript memory
            result = new result.constructor(result);
          }
          if (result instanceof Error) {
            reject(result);
          } else {
            resolve(result);
          }        };
      });
    }
    const cb = args[CALLBACK] = (ptr, result) => {
      if (func.length === 2) {
        const isError = result instanceof Error;
        func(isError ? result : null, isError ? null : result);
      } else {
        func(result);
      }
      args[FINALIZE]();
      const id = this.getFunctionId(cb);
      this.releaseFunction(id);
    };
    return cb;
  },
});

export { promiseCallback as default };
