import { Action, CallResult, StructFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, SLOTS, THROWING, VISIT } from '../symbols.js';

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
        const onError = (err) => {
          if (ArgStruct[THROWING] && err instanceof Error) {
            // see if the error is part of the error set of the error union returned by function
            try {
              argStruct.retval = err;
              return;
            } catch (_) {
            }
          }
          console.error(err);
          result = CallResult.Failure;
        };
        const onReturn = (value) => {
          argStruct.retval = value;
        };
        try {
          const retval = fn(...argStruct);
          if (retval?.[Symbol.toStringTag] === 'Promise') {
            if (futexHandle) {
              retval.then(onReturn, onError).then(() => {
                this.finalizeAsyncCall(futexHandle, result);
              });
              awaiting = true;
              result = CallResult.OK;
            } else {
              result = CallResult.Deadlock;
            }
          } else {
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
        for (const [ srcIndex, { structure } ] of members.entries()) {
          // error unions will throw on access, in which case we pass the error as the argument
          try {
            const arg = this[srcIndex];
            let optName, opt;
            if (structure.type === StructureType.Struct) {
              if (structure.flags & StructFlag.IsAllocator) {
                optName = (allocatorTotal === 1) ? `allocator` : `allocator${++allocatorCount}`;
                opt = arg;
              } else if (structure.flags & StructFlag.IsPromise) {
                optName = (++callbackCount === 1) ? 'callback' : '';
                opt = arg.callback['*'];
              } else if (structure.flags & StructFlag.IsAbortSignal) {
                optName = (++signalCount === 1) ? 'signal' : '';
                const target = arg.ptr[SLOTS][0];
                const dv = target[MEMORY];
                opt = Int32Array(dv.buffer, 0, 1);
              }
            }
            if (optName !== undefined) {
              if (optName) {
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
      const id = this.destroyJsThunk(controllerAddress, thunkAddress);
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

