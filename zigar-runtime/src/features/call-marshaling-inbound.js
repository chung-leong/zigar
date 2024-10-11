import { mixin } from '../environment.js';
import { MEMORY, THROWING } from '../symbols.js';

export default mixin({
  jsFunctionThunkMap: new Map(),
  jsFunctionCallerMap: new Map(),
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
    const funcId = this.getFunctionId(fn);
    let dv = this.jsFunctionThunkMap.get(funcId);
    if (dv === undefined) {
      const controllerAddr = this.getViewAddress(jsThunkController[MEMORY]);
      const thunkAddr = this.createJsThunk(controllerAddr, funcId);
      if (!thunkAddr) {
        throw new Error('Unable to create function thunk');
      }
      dv = this.obtainFixedView(thunkAddr, 0);
      this.jsFunctionThunkMap.set(funcId, dv);
    }
    return dv;
  },
  freeFunctionThunk(thunk, jsThunkController) {
    const controllerAddr = this.getViewAddress(jsThunkController[MEMORY]);
    const thunkAddr = this.getViewAddress(thunk);
    const id = this.destroyJsThunk(controllerAddr, thunkAddr);
    if (id) {
      this.jsFunctionThunkMap.delete(id);
      this.jsFunctionCallerMap.delete(id);
    }
  },
  createInboundCallers(fn, ArgStruct) {
    const self = function(...args) {
      return fn(...args);
    };
    const method = function(...args) {
      return fn.call(this, ...args);
    };
    const binary = (dv, asyncCallHandle) => {
      let result = CallResult.OK;
      let awaiting = false;
      try {
        const argStruct = ArgStruct(dv);
        const args = [];
        for (let i = 0; i < argStruct.length; i++) {
          args.push(argStruct[i]);
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
        try {
          const retval = fn(...args);
          if (retval?.[Symbol.toStringTag] === 'Promise') {
            if (asyncCallHandle) {
              retval.then(value => argStruct.retval = value, onError).then(() => {
                this.finalizeAsyncCall(asyncCallHandle, result);
              });
              awaiting = true;
              result = CallResult.OK;
            } else {
              result = CallResult.Deadlock;
            }
          } else {
            argStruct.retval = retval;
          }
        } catch (err) {
          onError(err);
        }
      } catch(err) {
        result = CallResult.Failure;
      }
      if (asyncCallHandle && !awaiting) {
        this.finalizeAsyncCall(asyncCallHandle, result);
      }
      return result;
    };
    const funcId = this.getFunctionId(fn);
    this.jsFunctionCallerMap.set(funcId, binary);
    return { self, method, binary };
  },
  runFunction(id, dv, futexHandle) {
    const caller = this.jsFunctionCallerMap.get(id);
    return caller?.(dv, futexHandle) ?? CallResult.Failure;
  },
  releaseFunction(id) {
    const thunk = this.jsFunctionThunkMap.get(id);
    if (thunk) {
      this.releaseFixedView(thunk);
    }
    this.jsFunctionThunkMap.delete(id);
    this.jsFunctionCallerMap.delete(id);
  },
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      performJsAction: { argType: 'iii', returnType: 'i' },
      queueJsAction: { argType: 'iiii' },
    },
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
      destroyJsThunk: { argType: 'ii', returnType: 'i' },
    },
    performJsAction(action, id, argAddress, argSize) {
      if (action === Action.Call) {
        const dv = this.obtainFixedView(argAddress, argSize);
        return this.runFunction(id, dv, 0);
      } else if (action === Action.Release) {
        return this.releaseFunction(id);
      }
    },
    queueJsAction(action, id, argAddress, argSize, futexHandle) {
      // in the main thread, this method is never called from WASM;
      // the implementation of queueJsAction() in worker.js, call this
      // through postMessage() when it is called the worker's WASM instance
      if (action === Action.Call) {
        const dv = this.obtainFixedView(argAddress, argSize);
        this.runFunction(id, dv, futexHandle);
      } else if (action === Action.Release) {
        this.releaseFunction(id);
      }
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      runFunction: null,
      releaseFunction: null,
    },
    imports: {
      createJsThunk: null,
      destroyJsThunk: null,
    },
  } : undefined),
});

const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};

const Action = {
  Call: 2,
  Release: 3,
};
