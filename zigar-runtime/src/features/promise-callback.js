import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { CALLBACK, FINALIZE, MEMORY, PROMISE, ZIG } from '../symbols.js';

export default mixin({
  createCallback(args, structure, func) {
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
    const cb = args[CALLBACK] = (result) => {
      const isError = result instanceof Error;
      if (!isError) {
        args[FINALIZE]();
      }
      const id = this.getFunctionId(cb);
      this.releaseFunction(id);
      if (func.length === 2) {
        return func(isError ? result : null, isError ? null : result);
      } else {
        return func(result);
      }
    };
    return cb;
  },
});