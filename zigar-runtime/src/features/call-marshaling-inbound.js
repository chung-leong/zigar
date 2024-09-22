import { mixin } from '../environment.js';
import { MEMORY, THROWING } from '../symbols.js';

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
  getFunctionThunk(fn, jsThunkController) {
    const funcId = this.getFunctionId(fn);
    if (!this.jsFunctionThunkMap) {
      this.jsFunctionThunkMap = new Map();
    }
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
    exports: {
      allocateJsThunk: { argType: 'ii', returnType: 'i' },
      freeJsThunk: { argType: 'ii', returnType: 'b' },
      performJsCall: { argType: 'iii', returnType: 'i' },
    },
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
      destroyJsThunk: { argType: 'ii', returnType: 'b' },
    },
    thunkSources: [],
    addJsThunkSource() {
      const {
        memoryInitial,
        memoryMax,
        tableInitial,
        multithreaded,
      } = this.options;
      const w = WebAssembly;
      const env = {}, wasi = {}, wasiPreview = {};
      const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      const empty = function() {};
      for (const { module, name, kind } of w.Module.imports(this.executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = empty;
          } else if (module === 'wasi') {
            wasi[name] = empty;
          }
        }
      }
      env.memory = new w.Memory({
        initial: memoryInitial,
        maximum: memoryMax,
        shared: multithreaded,
      });
      const table = env.__indirect_function_table = new w.Table({
        initial: tableInitial,
        element: 'anyfunc',
      });
      const instance = new w.Instance(this.executable, imports);
      const { createJsThunk } = instance.exports;
      const source = {
        thunkCount: 0,
        createJsThunk,
        table,
      };
      this.thunkSources.unshift(source);
      return source;
    },
    allocateJsThunk(controllerAddress, funcId) {
      let source, sourceAddress = 0;
      for (source of this.thunkSources) {
        sourceAddress = source.createJsThunk(controllerAddress, funcId);
        break;
      }
      if (!source) {
        source = this.addJsThunkSource();
        sourceAddress = source.createJsThunk(controllerAddress, funcId);
      }
      // sourceAddress is an index into the function table of the source instance
      // we need to get the function object and place it into the main instance's
      // function table
      const thunkObject = source.table.get(sourceAddress);
      let thunkAddress = 0;
      for (let i = this.table.length - 1; i >= this.initialTableLength; i--) {
        if (!this.table.get(i)) {
          thunkAddress = i;
          break;
        }
      }
      if (!thunkAddress) {
        thunkAddress = this.table.length;
        this.table.grow(8);
      }
      this.table.set(thunkAddress, thunkObject);
      source.thunkCount++;
      return thunkAddress;
    },
    freeJsThunk(controllerAddress, thunkAddress) {
      // TODO
    },
    performJsCall(id, argAddress, argSize) {
      const dv = this.obtainFixedView(argAddress, argSize);
      return this.runFunction(id, dv, 0);
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      runFunction: null,
    },
    imports: {
      createJsThunk: null,
    },
  } : undefined),
});

export const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};
