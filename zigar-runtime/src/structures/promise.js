import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { FINALIZE, MEMORY, PROMISE, RETURN, STRING_RETVAL, ZIG } from '../symbols.js';
import { usize } from '../utils.js';

export default mixin({
  init() {
    this.promiseCallbackMap = new Map();
    this.promiseContextMap = new Map();
    this.nextPromiseContextId = usize(0x1000);
  },
  // create promise struct for outbound call
  createPromiseStruct(structure, args, func) {
    const { constructor } = structure;
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
            if (args[STRING_RETVAL] && result) {
              result = result.string;
            }
            resolve(result);
          };
        };
      });
    }
    // create a handle referencing the function 
    const contextId = this.nextPromiseContextId++;
    const ptr = this.obtainZigView(contextId, 0, false);
    this.promiseContextMap.set(contextId, { func, args });
    // use the same callback for all promises of a given type
    let callback = this.promiseCallbackMap.get(constructor);
    if (!callback) {
      callback = (ptr, result) => {
        // the function assigned to args[RETURN] down below calls this function
        // with a DataView instead of an actual pointer
        const dv = (ptr instanceof DataView) ? ptr : ptr['*'][MEMORY];
        const contextId = this.getViewAddress(dv);
        const instance = this.promiseContextMap.get(contextId);
        if (instance) {
          const { func, args } = instance;
          if (func.length === 2) {
            const isError = result instanceof Error;
            func(isError ? result : null, isError ? null : result);
          } else {
            func(result);
          }
          args[FINALIZE]();
          this.promiseContextMap.delete(contextId);  
        }
      };
      this.promiseCallbackMap.set(constructor, callback);
      this.destructors.push(() => this.freeFunction(callback));
    }
    args[RETURN] = result => callback(ptr, result);
    return { ptr, callback };
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