import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { CALLBACK, FINALIZE, MEMORY, PROMISE, ZIG } from '../symbols.js';

export default mixin({
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
          };
        };
        });
    }
    const cb = args[CALLBACK] = (ptr, result) => {
      if (func.length === 2) {
        func(result instanceof Error ? result : null, isError ? null : result);
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