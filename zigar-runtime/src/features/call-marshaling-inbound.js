import { Action, CallResult, MemberType, StructFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { CALLBACK, MEMORY, THROWING, VISIT, ZIG } from '../symbols.js';

export default mixin({
  jsFunctionThunkMap: new Map(),
  jsFunctionCallerMap: new Map(),
  jsFunctionControllerMap: new Map(),
  jsFunctionIdMap: null,
  jsFunctionNextId: 1,

  getFunctionId(fn) {
    if (!this.jsFunctionIdMap) {
      this.jsFunctionIdMap = new WeakMap();
    }
    let id = this.jsFunctionIdMap.get(fn);
    if (id === undefined) {
      id = this.jsFunctionNextId++;
      this.jsFunctionIdMap.set(fn, id);
    }
    return id;
  },
  getFunctionThunk(fn, jsThunkController) {
    const id = this.getFunctionId(fn);
    let dv = this.jsFunctionThunkMap.get(id);
    if (dv === undefined) {
      const controllerAddress = this.getViewAddress(jsThunkController[MEMORY]);
      const thunkAddress = this.createJsThunk(controllerAddress, id);
      if (!thunkAddress) {
        throw new Error('Unable to create function thunk');
      }
      dv = this.obtainZigView(thunkAddress, 0);
      this.jsFunctionThunkMap.set(id, dv);
      this.jsFunctionControllerMap.set(id, jsThunkController);
    }
    return dv;
  },
  createInboundCaller(fn, ArgStruct) {
    const handler = (dv, futexHandle) => {
      let result = CallResult.OK;
      let awaiting = false;
      try {
        const argStruct = ArgStruct(dv);
        if (VISIT in argStruct) {
          const context = this.startContext();
          this.updatePointerTargets(context, argStruct, true);
          this.updateShadowTargets(context);
          this.endContext();
        }
        const onError = function(err) {
          try {
            const cb = argStruct[CALLBACK];
            // if the error is not part of the error set returned by the function,
            // the following will throw
            if (cb) {
              cb(err);
            } else if (ArgStruct[THROWING] && err instanceof Error) {
              argStruct.retval = err;
            } else {
              throw err;
            }
          } catch (_) {
            result = CallResult.Failure;
            console.error(err);
          }
        };
        const onReturn = function(value) {
          const cb = argStruct[CALLBACK];
          try {
            if (cb) {
              cb(value);
            } else {
              argStruct.retval = value;
            }
          } catch (err) {
            result = CallResult.Failure;
            console.error(err);
          }
        };
        try {
          const retval = fn(...argStruct);
          if (retval?.[Symbol.toStringTag] === 'Promise') {
            if (futexHandle || argStruct[CALLBACK]) {
              const promise = retval.then(onReturn, onError);
              if (futexHandle) {
                promise.then(() => this.finalizeAsyncCall(futexHandle, result));
              }
              awaiting = true;
              result = CallResult.OK;
            } else {
              result = CallResult.Deadlock;
            }
          } else if (retval !== undefined) {
            onReturn(retval);
          }
        } catch (err) {
          onError(err);
        }
      } catch(err) {
        console.error(err);
        result = CallResult.Failure;
      }
      if (futexHandle && !awaiting) {
        this.finalizeAsyncCall(futexHandle, result);
      }
      return result;
    };
    const id = this.getFunctionId(fn);
    this.jsFunctionCallerMap.set(id, handler);
    return function(...args) {
      return fn(...args);
    };
  },
  defineArgIterator(members) {
    const allocatorTotal = members.filter(({ structure: s }) => {
      return (s.type === StructureType.Struct) && (s.flags & StructFlag.IsAllocator);
    }).length;
    return {
      value() {
        let options;
        let allocatorCount = 0, callbackCount = 0, signalCount = 0;
        const args = [];
        for (const [ srcIndex, { structure, type } ] of members.entries()) {
          // error unions will throw on access, in which case we pass the error as the argument
          try {
            let arg = this[srcIndex];
            let optName, opt;
            if (structure.type === StructureType.Struct) {
              if (structure.flags & StructFlag.IsAllocator) {
                optName = (allocatorTotal === 1) ? `allocator` : `allocator${++allocatorCount}`;
                opt = arg;
              } else if (structure.flags & StructFlag.IsPromise) {
                optName = 'callback';
                if (++callbackCount === 1) {
                  const callback = this[CALLBACK] = arg.callback['*'];
                  opt = (...args) => callback((args.length === 2) ? args[0] ?? args[1] : args[0]);
                }
              } else if (structure.flags & StructFlag.IsAbortSignal) {
                optName = 'signal';
                if (++signalCount === 1) {
                  const controller = new AbortController();
                  if (arg.ptr['*']) {
                    controller.abort();
                  } else {
                    const interval = setInterval(() => {
                      if (arg.ptr['*']) {
                        controller.abort();
                        clearInterval(interval);
                      }
                    }, 50);
                  }
                  opt = controller.signal;
                }
              }
            }
            if (optName !== undefined) {
              if (opt !== undefined) {
                options ??= {};
                options[optName] = opt;
              }
            } else {
              // just a regular argument
              if (type === MemberType.Object && typeof(arg) === 'object' && arg[MEMORY]?.[ZIG]) {
                // create copy in JS memory
                arg = new arg.constructor(arg);
              }
              args.push(arg);
            }
          } catch (err) {
            args.push(err);
          }
        }
        if (options) {
          args.push(options);
        }
        return args[Symbol.iterator]();
      }
    };
  },
  performJsAction(action, id, argAddress, argSize, futexHandle = 0) {
    if (action === Action.Call) {
      const dv = this.obtainZigView(argAddress, argSize);
      if(process.env.TARGET === 'node') {
        if (id) {
          return this.runFunction(id, dv, futexHandle);
        } else {
          const result = this.writeToConsole(dv) ? CallResult.OK : CallResult.Failure;
          if (futexHandle) {
            this.finalizeAsyncCall(futexHandle, result);
          }
          return result;
        }
      } else {
        return this.runFunction(id, dv, futexHandle);
      }
    } else if (action === Action.Release) {
      return this.releaseFunction(id);
    }
  },
  runFunction(id, dv, futexHandle) {
    const caller = this.jsFunctionCallerMap.get(id);
    if (!caller) {
      return CallResult.Failure;
    }
    return caller(dv, futexHandle);
  },
  releaseFunction(id) {
    const thunk = this.jsFunctionThunkMap.get(id);
    const controller = this.jsFunctionControllerMap.get(id);
    if (thunk && controller) {
      const controllerAddress = this.getViewAddress(controller[MEMORY]);
      const thunkAddress = this.getViewAddress(thunk);
      this.destroyJsThunk(controllerAddress, thunkAddress);
      this.releaseZigView(thunk);
      if (id) {
        this.jsFunctionThunkMap.delete(id);
        this.jsFunctionCallerMap.delete(id);
        this.jsFunctionControllerMap.delete(id);
      }
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      performJsAction: { argType: 'iiii', returnType: 'i' },
      queueJsAction: { argType: 'iiiii' },
    },
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
      destroyJsThunk: { argType: 'ii', returnType: 'i' },
      finalizeAsyncCall: { argType: 'ii' },
    },
    queueJsAction(action, id, argAddress, argSize, futexHandle) {
      // in the main thread, this method is never called from WASM;
      // the implementation of queueJsAction() in worker.js, call this
      // through postMessage() when it is called the worker's WASM instance
      this.performJsAction(action, id, argAddress, argSize, futexHandle);
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      performJsAction: null,
    },
    imports: {
      createJsThunk: null,
      destroyJsThunk: null,
      finalizeAsyncCall: null,
    },
  /* c8 ignore next */
  } : undefined),
});

