import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';

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
  getFunctionThunk(constructorAddr, funcId) {
    if (!this.jsFunctionThunkMap) {
      this.jsFunctionThunkMap = new Map();
    }
    let dv = this.jsFunctionThunkMap.get(funcId);
    if (dv === undefined) {
      dv = this.runJsThunkConstructor(constructorAddr, funcId);
      if (typeof(dv) === 'string') {
        throw new ZigError(dv);
      }
      this.jsFunctionThunkMap.set(funcId, dv);
    }
    return dv;
  },
  setFunctionCaller(id, caller) {
    if (!this.jsFunctionCallerMap) {
      this.jsFunctionCallerMap = new Map();
    }
    this.jsFunctionCallerMap.set(id, caller);
  },
  runFunction(id, dv, futexHandle) {
    const caller = this.jsFunctionCallerMap.get(id);
    return caller?.(dv, futexHandle) ?? CallResult.Failure;
  },
  ...(process.env.TARGET === 'wasm' ? {
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
      runJsThunkConstructor: null,
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