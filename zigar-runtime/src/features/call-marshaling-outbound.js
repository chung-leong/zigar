import { mixin } from '../environment.js';
import { Exit, ZigError } from '../errors.js';
import { ATTRIBUTES, MEMORY, VISIT } from '../symbols.js';

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
  createOutboundCallers(thunk, ArgStruct) {
    const invoke = (argStruct) => {
      const thunkAddr = this.getViewAddress(thunk[MEMORY]);
      const funcAddr = this.getViewAddress(self[MEMORY]);
      this.invokeThunk(thunkAddr, funcAddr, argStruct);
    };
    const self = function (...args) {
      const argStruct = new ArgStruct(args, self.name, 0);
      invoke(argStruct);
      return argStruct.retval;
    };
    const method = function(...args) {
      const argStruct = new ArgStruct([ this, ...args ], self.name, 1);
      invoke(argStruct);
      return argStruct.retval;
    };
    const binary = function(dv) {
      invoke(ArgStruct(dv));
    };
    return { self, method, binary };
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      runThunk: { argType: 'iii', returnType: 'b' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'b' },
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
        const hasPointers = VISIT in args;
        if (hasPointers) {
          this.updatePointerAddresses(args);
        }
        // return address of shadow for argumnet struct
        const argAddress = this.getShadowAddress(args);
        const attrs = args[ATTRIBUTES];
        // get address of attributes if function variadic
        const attrAddress = (attrs) ? this.getShadowAddress(attrs) : 0;
        this.updateShadows();
        const success = (attrs)
        ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
        : this.runThunk(thunkAddress, fnAddress, argAddress);
        if (!success) {
          throw new ZigError();
        }
        // create objects that pointers point to
        this.updateShadowTargets();
        if (hasPointers) {
          this.updatePointerTargets(args);
        }
        this.releaseShadows();
        // restore the previous context if there's one
        this.endContext();
        if (!this.context) {
          this.flushConsole?.();
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

    invokeThunk(thunkAddress, fnAddress, args) {
      // create an object where information concerning pointers can be stored
      this.startContext();
      const hasPointers = VISIT in args;
      const attrs = args[ATTRIBUTES];
      if (hasPointers) {
        // copy addresses of garbage-collectible objects into memory
        this.updatePointerAddresses(args);
        this.updateShadows();
      }
      const success = (attrs)
      ? this.runVariadicThunk(thunkAddress, fnAddress, args[MEMORY], attrs[MEMORY])
      : this.runThunk(thunkAddress, fnAddress, args[MEMORY]);
      if (!success) {
        throw new ZigError();
      }
      if (hasPointers) {
        // create objects that pointers point to
        this.updateShadowTargets();
        this.updatePointerTargets(args);
        this.releaseShadows();
      }
      // restore the previous context if there's one
      this.endContext();
      if (!this.context) {
        this.flushConsole?.();
      }
    },
    /* c8 ignore next */
  } : undefined),
});

export class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
  shadowMap = null;
  call = 0;
}
