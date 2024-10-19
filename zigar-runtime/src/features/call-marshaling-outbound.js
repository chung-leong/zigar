import { MemberType, StructFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { adjustArgumentError, Exit, UndefinedArgument, ZigError } from '../errors.js';
import { ATTRIBUTES, CONTEXT, FINALIZE, MEMORY, PROMISE, VISIT } from '../symbols.js';

export default mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      try {
        const argStruct = new ArgStruct(args);
        thisEnv.invokeThunk(thunk, self, argStruct);
        return argStruct[PROMISE] ?? argStruct.retval;
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
      let arg;
      if (structure.type === StructureType.Struct) {
        if (structure.flags & StructFlag.IsAllocator) {
          // use programmer-supplied allocator if found in options object, handling rare scenarios
          // where a function uses multiple allocators
          allocatorCount++;
          const allocator = (allocatorCount === 1)
          ? options?.['allocator'] ?? options?.['allocator1']
          : options?.[`allocator${allocatorCount}`];
          // otherwise use default allocator which allocates relocatable memory from JS engine
          arg = allocator ?? this.createDefaultAllocator(dest, structure);
        } else if (structure.flags & StructFlag.IsPromise) {
          // invoke programmer-supplied callback if there's one, otherwise a function that
          // resolves/rejects a promise attached to the argument struct
          arg = { callback: this.createCallback(dest, structure, options?.['callback']) };
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          arg = { ptr: this.createSignalArray(dest, structure, options?.['signal']) };
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
    if (process.env.TARGET === 'wasm') {
      if (!this.runThunk) {
        return this.initPromise.then(() => {
          return this.invokeThunk(thunk, fn, args);
        });
      }
    }
    const context = args[CONTEXT];
    const attrs = args[ATTRIBUTES];
    const thunkAddress = this.getViewAddress(thunk[MEMORY]);
    const fnAddress = this.getViewAddress(fn[MEMORY]);
    const hasPointers = VISIT in args;
    if (hasPointers) {
      this.updatePointerAddresses(context, args);
    }
    // return address of shadow for argumnet struct
    const argAddress = (process.env.TARGET === 'wasm')
    ? this.getShadowAddress(context, args)
    : this.getViewAddress(args[MEMORY]);
    // get address of attributes if function variadic
    const attrAddress = (process.env.TARGET === 'wasm')
    ? (attrs) ? this.getShadowAddress(context, attrs) : 0
    : (attrs) ? this.getViewAddress(attrs[MEMORY]) : 0;
    const attrLength = attrs?.[MEMORY]?.byteLength;
    this.updateShadows(context);
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrLength)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    if (!success) {
      throw new ZigError();
    }
    const finalize = () => {
      // create objects that pointers point to
      this.updateShadowTargets(context);
      if (hasPointers) {
        this.updatePointerTargets(context, args);
      }
      this.releaseShadows(context);
      this.releaseCallContext?.(context);
      this.flushConsole?.();
    };
    if (FINALIZE in args) {
      // async function--finalization happens when callback is invoked
      args[FINALIZE] = finalize;
    } else {
      finalize();
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
