import { StructureType, StructFlag, MemberType, Action, CallResult } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, ZIG, ALLOCATOR, VISIT, THROWING, RETURN, YIELD } from '../symbols.js';

var callMarshalingInbound = mixin({
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
          // reset pointers in arg so we don't pick up old pointers
          // objects in stack memory really shouldn't be cached
          argStruct[VISIT]('reset');
          const context = this.startContext();
          this.updatePointerTargets(context, argStruct, true);
          this.updateShadowTargets(context);
          this.endContext();
        }
        const onError = function(err) {
          try {
            // if the error is not part of the error set returned by the function,
            // the following will throw
            if (ArgStruct[THROWING] && err instanceof Error) {
              argStruct[RETURN](err);
            } else {
              throw err;
            }
          } catch (_) {
            result = CallResult.Failure;
            console.error(err);
          }
        };
        const onReturn = function(value) {
          try {
            // [RETURN] defaults to the setter of retval; if the function accepts a promise,
            // it'd invoke the callback
            argStruct[RETURN](value);
          } catch (err) {
            result = CallResult.Failure;
            console.error(err);
          }
        };
        try {
          const retval = fn(...argStruct);
          const hasCallback = argStruct.hasOwnProperty(RETURN);
          if (retval?.[Symbol.toStringTag] === 'Promise') {
            // we can handle a promise when the Zig caller is able to wait or
            // it's receiving the result through a callback
            if (futexHandle || hasCallback) {
              const promise = retval.then(onReturn, onError);
              if (futexHandle) {
                promise.then(() => this.finalizeAsyncCall(futexHandle, result));
              }
              awaiting = true;
              result = CallResult.OK;
            } else {
              result = CallResult.Deadlock;
            }
          } else if (retval?.[Symbol.asyncIterator]) {
            if (argStruct.hasOwnProperty(YIELD)) {
              this.pipeContents(retval, argStruct);
              result = CallResult.OK;
            } else {
              throw new UnexpectedAsyncIterator();
            }
          } else if (retval != undefined || !hasCallback) {
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
            if (type === MemberType.Object && arg?.[MEMORY]?.[ZIG]) {
              // create copy in JS memory
              arg = new arg.constructor(arg);
            }
            let optName, opt;
            if (structure.type === StructureType.Struct) {
              if (structure.flags & StructFlag.IsAllocator) {
                optName = (allocatorTotal === 1) ? `allocator` : `allocator${++allocatorCount}`;
                opt = this[ALLOCATOR] = arg;
              } else if (structure.flags & StructFlag.IsPromise) {
                optName = 'callback';
                if (++callbackCount === 1) {
                  opt = this.createPromiseCallback(args, arg);
                }
              } else if (structure.flags & StructFlag.IsGenerator) {
                optName = 'callback';
                if (++callbackCount === 1) {
                  opt = this.createGeneratorCallback(args, arg);
                }
              } else if (structure.flags & StructFlag.IsAbortSignal) {
                optName = 'signal';
                if (++signalCount === 1) {
                  opt = this.createInboundSignal(arg);
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
      let result;
      {
        result = this.runFunction(id, dv, futexHandle);
      }
      if (id) {
        // for function calls the argAddress will be point to the stack
        this.releaseZigView(dv);
      }
      return result;
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
  ...({
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
  } ),
});

export { callMarshalingInbound as default };
