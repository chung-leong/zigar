import { Action, CallResult } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, THROWING, VISIT } from '../symbols.js';

export default mixin({
  jsFunctionThunkMap: new Map(),
  jsFunctionCallerMap: new Map(),
  jsFunctionControllerMap: new Map(),
  jsFunctionIdMap: null,
  jsFunctionNextId: 8888,

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
      dv = this.obtainFixedView(thunkAddress, 0);
      this.jsFunctionThunkMap.set(id, dv);
      this.jsFunctionControllerMap.set(id, jsThunkController);
    }
    return dv;
  },
  freeFunctionThunk(thunk, jsThunkController) {
    const controllerAddress = this.getViewAddress(jsThunkController[MEMORY]);
    const thunkAddress = this.getViewAddress(thunk);
    const id = this.destroyJsThunk(controllerAddress, thunkAddress);
    this.releaseFixedView(thunk);
    if (id) {
      this.jsFunctionThunkMap.delete(id);
      this.jsFunctionCallerMap.delete(id);
      this.jsFunctionControllerMap.delete(id);
    }
  },
  createInboundCaller(fn, ArgStruct) {
    const handler = (dv, futexHandle) => {
      let result = CallResult.OK;
      let awaiting = false;
      try {
        const argStruct = ArgStruct(dv);
        const hasPointers = VISIT in argStruct;
        if (hasPointers) {
          this.updatePointerTargets(null, argStruct);
        }
        const args = [];
        for (let i = 0; i < argStruct.length; i++) {
          // error unions will throw on access, in which case we pass the error as the argument
          try {
            args.push(argStruct[i]);
          } catch (err) {
            args.push(err);
          }
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
          argStruct.retval = value
          if (hasPointers) {
            this.updatePointerAddresses(null, argStruct);
          }
        };
        try {
          const retval = fn(...args);
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
  performJsAction(action, id, argAddress, argSize, futexHandle = 0) {
    if (action === Action.Call) {
      const dv = this.obtainFixedView(argAddress, argSize);
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
      this.freeFunctionThunk(thunk, controller);
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
  } : undefined),
});

