import { MemberType, PosixError, StructurePurpose, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, UnexpectedGenerator } from '../errors.js';
import { ALLOCATOR, MEMORY, RETURN, THROWING, VISIT, YIELD, ZIG } from '../symbols.js';

export default mixin({
  init() {
    this.jsFunctionThunkMap = new Map();
    this.jsFunctionCallerMap = new Map();
    this.jsFunctionControllerMap = new Map();
    this.jsFunctionIdMap = new WeakMap();
    this.jsFunctionNextId = 1;
  },
  getFunctionId(fn) {
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
    const handler = (dv, canWait) => {
      if (process.env.DEV) {
        this.inboundCallCount++;
      }
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
        const hasCallback = argStruct.hasOwnProperty(RETURN);
        // promise is acceptable when we can wait for it or its result is sent to a callback
        const result = catchPosixError(canWait || hasCallback, PosixError.EFAULT, () => {
          return fn(...argStruct);
        }, (retval) => {
            if (retval?.[Symbol.asyncIterator]) {
              // send contents through [YIELD]
              if (!argStruct.hasOwnProperty(YIELD)) {
                throw new UnexpectedGenerator();
              }
              this.pipeContents(retval, argStruct);
            } else {
              // [RETURN] defaults to the setter of retval; if the function accepts a promise,
              // it'd invoke the callback
              argStruct[RETURN](retval);
            }
        }, (err) => {
            try {
              // if the error is not part of the error set returned by the function,
              // the following will throw
              if (ArgStruct[THROWING] && err instanceof Error) {                
                argStruct[RETURN](err);
                return PosixError.NONE;
              } else {
                throw err;
              }
            } catch (_) {
              console.error(err);
            }
        });
        // don't return promise when a callback is used
        return (hasCallback) ? PosixError.NONE : result;
      } catch (err) {
        console.error(err);
        return PosixError.EFAULT;
      }     
    };
    const id = this.getFunctionId(fn);
    this.jsFunctionCallerMap.set(id, handler);
    return function(...args) {
      return fn(...args);
    };
  },
  defineArgIterator(members) {
    const thisEnv = this;
    const allocatorTotal = members.filter(({ structure: s }) => {
      return (s.type === StructureType.Struct) && (s.purpose === StructurePurpose.Allocator);
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
              switch (structure.purpose) {
                case StructurePurpose.Allocator: 
                  optName = (allocatorTotal === 1) ? `allocator` : `allocator${++allocatorCount}`;
                  opt = this[ALLOCATOR] = arg;
                  break;
                case StructurePurpose.Promise:
                  optName = 'callback';
                  if (++callbackCount === 1) {
                    opt = thisEnv.createPromiseCallback(this, arg);
                  }
                  break;
                case StructurePurpose.Generator:
                  optName = 'callback';
                  if (++callbackCount === 1) {
                    opt = thisEnv.createGeneratorCallback(this, arg);
                  }
                  break;
                case StructurePurpose.AbortSignal:
                  optName = 'signal';
                  if (++signalCount === 1) {
                    opt = thisEnv.createInboundSignal(arg);
                  }
                  break;
              }
            }
            if (optName !== undefined) {
              if (opt !== undefined) {
                options ||= {};
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
  handleJsCall(id, argAddress, argSize, canWait) {
    const dv = this.obtainZigView(argAddress, argSize, false);
    const caller = this.jsFunctionCallerMap.get(id);
    return (caller) ? caller(dv, canWait) : PosixError.EFAULT;
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
  freeFunction(func) {
    this.releaseFunction(this.getFunctionId(func));
  },
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      handleJsCall: { argType: 'iiib', returnType: 'i' },
      releaseFunction: { argType: 'i' },
    },
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
      destroyJsThunk: { argType: 'ii', returnType: 'i' },
      finalizeAsyncCall: { argType: 'ii' },
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      handleJsCall: {},
      releaseFunction: {},
    },
    imports: {
      createJsThunk: {},
      destroyJsThunk: {},
      finalizeAsyncCall: {},
    },
  /* c8 ignore next */
  } : undefined),
  /* c8 ignore start */
  ...(process.env.DEV ? {
    inboundCallCount: 0,

    diagCallMarshallingInbound() {
      this.showDiagnostics('Inbound call marshalling', [
        `Call count: ${this.inboundCallCount}`,
        `Active thunk count: ${this.jsFunctionThunkMap.size}`,
        `Next function id: ${this.jsFunctionNextId}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});

