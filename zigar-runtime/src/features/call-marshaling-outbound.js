import { mixin } from '../environment.js';
import { StructureType } from '../structures/all.js';

export default mixin({
  context: undefined,
  contextStack: [],

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  },
  endContext() {
    this.context = this.contextStack.pop();
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      runThunk: { argType: 'iii', returnType: 'v' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'v' },
    },
    exports: {
      allocateHostMemory: { argType: 'ii', returnType: 'v' },
      freeHostMemory: { argType: 'iii' },
    },

    invokeThunk(thunkAddress, fnAddress, args) {
      // runThunk will be present only after WASM has compiled
      if (this.runThunk) {
        return this.invokeThunkNow(thunkAddress, fnAddress, args);
      } else {
        return this.initPromise.then(() => {
          return this.invokeThunkNow(thunkAddress, fnAddress, args);
        });
      }
    },
    invokeThunkNow(thunkAddress, fnAddress, args) {
      try {
        this.startContext();
        if (args[VISITOR]) {
          this.updatePointerAddresses(args);
        }
        // return address of shadow for argumnet struct
        const address = this.getShadowAddress(args);
        const attrs = args[ATTRIBUTES];
        // get address of attributes if function variadic
        const attrAddress = (attrs) ? this.getShadowAddress(attrs) : 0;
        this.updateShadows();
        const err = (attrs)
        ? this.runVariadicThunk(thunkAddress, fnAddress, address, attrAddress, attrs.length)
        : this.runThunk(thunkAddress, fnAddress, address);
        // create objects that pointers point to
        this.updateShadowTargets();
        if (args[VISITOR]) {
          this.updatePointerTargets(args);
        }
        this.releaseShadows();
        // restore the previous context if there's one
        this.endContext();
        if (!this.context && this.flushConsole) {
          this.flushStdout();
          this.flushConsole();
        }
        // errors returned by exported Zig functions are normally written into the
        // argument object and get thrown when we access its retval property (a zig error union)
        // error strings returned by the thunk are due to problems in the thunking process
        // (i.e. bugs in export.zig)
        if (err) {
          throw new ZigError(err);
        }
        return args.retval;
      } catch (err) {
        // do nothing when exit code is 0
        if (!(err instanceof Exit && err.code === 0)) {
          throw err;
        }
      }
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      runThunk: null,
      runVariadicThunk: null,
    },
    exports: {
      runFunction: null,
    },

    invokeThunk(thunkAddress, fnAddress, args) {
      // create an object where information concerning pointers can be stored
      this.startContext();
      const hasPointers = args[VISITOR];
      const attrs = args[ATTRIBUTES];
      if (hasPointers) {
        // copy addresses of garbage-collectible objects into memory
        this.updatePointerAddresses(args);
        this.updateShadows();
      }
      const err = (attrs)
      ? this.runVariadicThunk(thunkAddress, fnAddress, args[MEMORY], attrs[MEMORY])
      : this.runThunk(thunkAddress, fnAddress, args[MEMORY]);
      if (hasPointers) {
        // create objects that pointers point to
        this.updateShadowTargets();
        this.updatePointerTargets(args);
        this.releaseShadows();
      }
      // restore the previous context if there's one
      this.endContext();
      if (!this.context) {
        this.flushConsole();
      }
      // errors returned by exported Zig functions are normally written into the
      // argument object and get thrown when we access its retval property (a zig error union)
      // error strings returned by the thunk are due to problems in the thunking process
      // (i.e. bugs in export.zig)
      if (err) {
        throw new ZigError(err);
      }
    },
  } : {}),
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Function;
}

export class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
  shadowMap = null;
  /* WASM-ONLY */
  call = 0;
  /* WASM-ONLY-END */
}
