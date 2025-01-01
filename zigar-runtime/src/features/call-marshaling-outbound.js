import { MemberType, StructFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { adjustArgumentError, Exit, UndefinedArgument, ZigError } from '../errors.js';
import { ATTRIBUTES, CALLBACK, COPY, FINALIZE, MEMORY, PROMISE, VISIT } from '../symbols.js';

export default mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      if (process.env.TARGET === 'wasm') {
        if (!thisEnv.runThunk) {
          return thisEnv.initPromise.then(() => {
            return self(...args);
          });
        }
      }
      try {
        return thisEnv.invokeThunk(thunk, self, new ArgStruct(args));
      } catch (err) {
        if ('fnName' in err) {
          err.fnName = self.name;
        }
        if (process.env.TARGET === 'wasm') {
          // do nothing when exit code is 0
          if (err instanceof Exit && err.code === 0) {
            return;
          }
        }
        throw err;
      }
    };
    return self;
  },
  copyArguments(dest, src, members, options) {
    let srcIndex = 0;
    let allocatorCount = 0;
    for (const [ destIndex, { type, structure } ] of members.entries()) {
      let arg, promise, signal;
      if (structure.type === StructureType.Struct) {
        if (structure.flags & StructFlag.IsAllocator) {
          // use programmer-supplied allocator if found in options object, handling rare scenarios
          // where a function uses multiple allocators
          const allocator = (++allocatorCount === 1)
          ? options?.['allocator'] ?? options?.['allocator1']
          : options?.[`allocator${allocatorCount}`];
          // otherwise use default allocator which allocates relocatable memory from JS engine
          arg = allocator ?? this.createDefaultAllocator(dest, structure);
        } else if (structure.flags & StructFlag.IsPromise) {
          // invoke programmer-supplied callback if there's one, otherwise a function that
          // resolves/rejects a promise attached to the argument struct
          if (!promise) {
            promise = {
              ptr: null, 
              callback: this.createCallback(dest, structure, options?.['callback']),
            };
          }
          arg = promise;
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          if (!signal) {
            signal = { ptr: this.createSignalArray(dest, structure, options?.['signal']) }
          }
          arg = signal;
        }
      }
      if (arg === undefined) {
        // just a regular argument
        arg = src[srcIndex++];
        // only void has the value of undefined
        if (arg === undefined && type !== MemberType.Void) {
          throw new UndefinedArgument();
        }
      }
      try {
        dest[destIndex] = arg;
      } catch (err) {
        throw adjustArgumentError.call(err, destIndex, src.length);
      }
    }
  },
  invokeThunk(thunk, fn, args) {
    const context = this.startContext();
    const attrs = args[ATTRIBUTES];
    const thunkAddress = this.getViewAddress(thunk[MEMORY]);
    const fnAddress = this.getViewAddress(fn[MEMORY]);
    const hasPointers = VISIT in args;
    if (hasPointers) {
      this.updatePointerAddresses(context, args);
    }
    // return address of shadow for argumnet struct
    const argAddress = (process.env.TARGET === 'wasm')
    ? this.getShadowAddress(context, args, null, false)
    : this.getViewAddress(args[MEMORY]);
    // get address of attributes if function variadic
    const attrAddress = (process.env.TARGET === 'wasm')
    ? (attrs) ? this.getShadowAddress(context, attrs) : 0
    : (attrs) ? this.getViewAddress(attrs[MEMORY]) : 0;
    this.updateShadows(context);
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    const finalize = (success) => {
      if (success) {
        this.updateShadowTargets(context);
        // create objects that pointers point to
        if (hasPointers) {
          this.updatePointerTargets(context, args);
        }
      }
      if (this.libc) {
        this.flushStdout?.();
      }
      this.flushConsole?.();
      this.endContext();
    };
    if (!success) {
      finalize(false);
      throw new ZigError();
    }
    if (process.env.TARGET === 'wasm') {
      // copy retval from shadow view
      args[COPY]?.(this.findShadowView(args[MEMORY]));
    }
    if (FINALIZE in args) {
      args[FINALIZE] = finalize;
    } else {
      finalize(true);
    }
    const promise = args[PROMISE];
    const callback = args[CALLBACK];
    if (callback) {
      try {
        // ensure the function hasn't return an error
        const { retval } = args;
        if (retval != null) {
          // if a function returns a value, then the promise is fulfilled immediately
          callback(retval);
        }
      } catch (err) {
        callback(err);
      }
      // this would be undefined if a callback function is used instead
      return promise;
    } else {
      return args.retval;
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      runThunk: { argType: 'iii', returnType: 'b' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'b' },
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      runThunk: null,
      runVariadicThunk: null,
    },
  /* c8 ignore next */
  } : undefined),
  ...(process.env.MIXIN === 'track' ? {
    usingPromise: false,
    usingAbortSignal: false,
    usingDefaultAllocator: false,

    detectArgumentFeatures(argMembers) {
      for (const { structure: { flags } } of argMembers) {
        if (flags & StructFlag.IsAllocator) {
          this.usingDefaultAllocator = true;
        } else if (flags & StructFlag.IsPromise) {
          this.usingPromise = true;
        } else if (flags & StructFlag.IsAbortSignal) {
          this.usingAbortSignal = true;
        }
      }
    }
  /* c8 ignore next */
  } : undefined),
});
