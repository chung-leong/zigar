import { mixin } from '../environment.js';
import { Exit, ZigError } from '../errors.js';
import { ATTRIBUTES, CONTEXT, MEMORY, VISIT } from '../symbols.js';

export default mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      try {
        const argStruct = new ArgStruct(args);
        const thunkAddr = thisEnv.getViewAddress(thunk[MEMORY]);
        const funcAddr = thisEnv.getViewAddress(self[MEMORY]);
        thisEnv.invokeThunk(thunkAddr, funcAddr, argStruct);
        return argStruct.retval;
      } catch (err) {
        if ('fnName' in err) {
          err.fnName = self.name;
        }
        throw err;
      }
    };
    return self;
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
        const context = args[CONTEXT];
        const hasPointers = VISIT in args;
        if (hasPointers) {
          this.updatePointerAddresses(context, args);
        }
        // return address of shadow for argumnet struct
        const argAddress = this.getShadowAddress(context, args);
        const attrs = args[ATTRIBUTES];
        // get address of attributes if function variadic
        const attrAddress = (attrs) ? this.getShadowAddress(context, attrs) : 0;
        this.updateShadows(context);
        const success = (attrs)
        ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
        : this.runThunk(thunkAddress, fnAddress, argAddress);
        if (!success) {
          throw new ZigError();
        }
        // create objects that pointers point to
        this.updateShadowTargets(context);
        if (hasPointers) {
          this.updatePointerTargets(context, args);
        }
        this.releaseShadows(context);
        this.flushConsole?.();
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
      const context = args[CONTEXT];
      const attrs = args[ATTRIBUTES];
      const hasPointers = VISIT in args;
      if (hasPointers) {
        // copy addresses of garbage-collectible objects into memory
        this.updatePointerAddresses(context, args);
        this.updateShadows(context);
      }
      const success = (attrs)
      ? this.runVariadicThunk(thunkAddress, fnAddress, args[MEMORY], attrs[MEMORY])
      : this.runThunk(thunkAddress, fnAddress, args[MEMORY]);
      if (!success) {
        throw new ZigError();
      }
      if (hasPointers) {
        // create objects that pointers point to
        this.updateShadowTargets(context);
        this.updatePointerTargets(context, args);
        this.releaseShadows(context);
      }
      this.flushConsole?.();
    },
    /* c8 ignore next */
  } : undefined),
});
