import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY } from '../symbols.js';

export default mixin({
  jsFunctionMap: null,
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
  getFunctionThunk(fn, jsThunkConstructor) {
    const funcId = this.getFunctionId(fn);
    if (!this.jsFunctionThunkMap) {
      this.jsFunctionThunkMap = new Map();
    }
    let dv = this.jsFunctionThunkMap.get(funcId);
    if (dv === undefined) {
      const constructorAddr = this.getViewAddress(jsThunkConstructor[MEMORY]);
      const thunkAddr = this.createJsThunk(constructorAddr, funcId);
      if (!thunkAddr) {
        throw new ZigError();
      }
      dv = this.obtainFixedView(thunkAddr, 0);
      this.jsFunctionThunkMap.set(funcId, dv);
    }
    return dv;
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
        const retval = fn(...args);
        if (retval?.[Symbol.toStringTag] === 'Promise') {
          if (asyncCallHandle) {
            retval.then((value) => {
              argStruct.retval = value;
            }).catch((err) => {
              console.error(err);
              result = CallResult.Failure;
            }).then(() => {
              this.finalizeAsyncCall(asyncCallHandle, result);
            });
            awaiting = true;
          } else {
            result = CallResult.Deadlock;
          }
        } else {
          argStruct.retval = retval;
        }
      } catch (err) {
        console.error(err);
        result = CallResult.Failure;
      }
      if (!awaiting && asyncCallHandle) {
        this.finalizeAsyncCall(asyncCallHandle, result);
      }
      return result;
    };
    const funcId = this.getFunctionId(fn);
    if (!this.jsFunctionCallerMap) {
      this.jsFunctionCallerMap = new Map();
    }
    this.jsFunctionCallerMap.set(funcId, binary);
    return { self, method, binary };
  },
  runFunction(id, dv, futexHandle) {
    const caller = this.jsFunctionCallerMap.get(id);
    return caller?.(dv, futexHandle) ?? CallResult.Failure;
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
    },
    exports: {
      allocateJsThunk: { argType: 'i', returnType: 'i' },
      performJsCall: { argType: 'iii', returnType: 'i' },
    },
    allocateJsThunk() {
      // TODO
    },
    performJsCall() {
      // TODO
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      createJsThunk: null,
    },
    export: {
      runFunction: null,
    },
  } : undefined),
});

export function isNeededByStructure(structure) {
  const { type, instance: { members } } = structure;
  if (type === StructureType.Pointer) {
    const { type: targetType } = members[0].structure;
    return targetType === StructureType.Function;
  }
  return false;
}

const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};
