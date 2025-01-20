import { MemberType, StructFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { adjustArgumentError, Exit, UndefinedArgument, ZigError } from '../errors.js';
import {
  ATTRIBUTES, COPY, FINALIZE, GENERATOR, MEMORY, PROMISE, RETURN, VISIT,
} from '../symbols.js';

export default mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      if (process.env.DEV) {
        thisEnv.outboundCallCount++;
      }
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
      let arg, promise, generator, signal;
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
              callback: this.createPromiseCallback(dest, options?.['callback']),
            };
          }
          arg = promise;
        } else if (structure.flags & StructFlag.IsGenerator) {
          if (!generator) {
            generator = {
              ptr: null,
              callback: this.createGeneratorCallback(dest, options?.['callback']),
            };
          }
          arg = generator;
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          if (!signal) {
            signal = { ptr: this.createSignalArray(structure, options?.['signal']) }
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
    /* c8 ignore start */
    if (process.env.MIXIN === 'track') {
      this.mixinUsageCapturing = new Map();
    }
    /* c8 ignore end */
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    /* c8 ignore start */
    if (process.env.MIXIN === 'track') {
      this.mixinUsage = this.mixinUsageCapturing;
      this.mixinUsageCapturing = null;
    }
    /* c8 ignore end */
    const finalize = () => {
      this.updateShadowTargets(context);
      // create objects that pointers point to
      if (hasPointers) {
        this.updatePointerTargets(context, args);
      }
      if (this.libc) {
        this.flushStdout?.();
      }
      this.flushConsole?.();
      this.endContext();
    };
    if (!success) {
      finalize();
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
    if (args.hasOwnProperty(RETURN)) {
      let retval = null;
      // if a function has returned a value or failed synchronmously, the promise is resolved immediately
      try {
        retval = args.retval;
      } catch (err) {
        retval = new ZigError(err, 1);
      }
      if (retval != null) {
        args[RETURN](retval);
      }
      // this would be undefined if a callback function is used instead
      return args[PROMISE] ?? args[GENERATOR];
    } else {
      try {
        return args.retval;
      } catch (err) {
        throw new ZigError(err, 1);
      }
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
  /* c8 ignore start */
  } : undefined),
  ...(process.env.MIXIN === 'track' ? {
    mixinUsage: null,
    mixinUsageCapturing: null,
    usingPromise: false,
    usingGenerator: false,
    usingAbortSignal: false,
    usingDefaultAllocator: false,
    usingVariables: false,

    detectArgumentFeatures(argMembers) {
      for (const { structure: { flags } } of argMembers) {
        if (flags & StructFlag.IsAllocator) {
          this.usingDefaultAllocator = true;
        } else if (flags & StructFlag.IsPromise) {
          this.usingPromise = true;
        } else if (flags & StructFlag.IsGenerator) {
          this.usingGenerator = true;
        } else if (flags & StructFlag.IsAbortSignal) {
          this.usingAbortSignal = true;
        }
      }
    }
  } : undefined),
  /* c8 ignore end */
  /* c8 ignore start */
  ...(process.env.DEV ? {
    outboundCallCount: 0,

    diagCallMarshallingOutbound() {
      this.showDiagnostics('Outbound call marshalling', [
        `Call count: ${this.outboundCallCount}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});
