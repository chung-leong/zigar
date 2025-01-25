import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { FINALIZE, MEMORY, PROMISE, RETURN, ZIG } from '../symbols.js';

export default mixin({
  // create promise struct for outbound call
  createPromise(args, func) {
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
    const callback = (ptr, result) => {
      if (func.length === 2) {
        const isError = result instanceof Error;
        func(isError ? result : null, isError ? null : result);
      } else {
        func(result);
      }
      args[FINALIZE]();
      const id = this.getFunctionId(callback);
      this.releaseFunction(id);
    };
    args[RETURN] = result => callback(null, result);
    return { ptr: null, callback };
  },
  // create callback for inbound call
  createPromiseCallback(args, promise) {
    const { ptr, callback } = promise;
    const f = callback['*'];
    args[RETURN] = result => f.call(args, ptr, result);
    return (...argList) => {
      const result = (argList.length === 2) ? argList[0] ?? argList[1] : argList[0];
      return args[RETURN](result);
    };
  },
});