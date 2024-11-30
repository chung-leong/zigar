import { StructureType, StructFlag, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { UndefinedArgument, adjustArgumentError, ZigError, Exit } from '../errors.js';
import { ATTRIBUTES, MEMORY, COPY, FINALIZE, PROMISE, CALLBACK, VISIT } from '../symbols.js';

var callMarshalingOutbound = mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      {
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
        {
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
      let arg, callback, signal;
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
          if (!callback) {
            callback = { callback: this.createCallback(dest, structure, options?.['callback']) };
          }
          arg = callback;
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          if (!signal) {
            signal = { ptr: this.createSignalArray(dest, structure, options?.['signal']) };
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
    const argAddress = this.getShadowAddress(context, args, null, false)
    ;
    // get address of attributes if function variadic
    const attrAddress = (attrs) ? this.getShadowAddress(context, attrs) : 0
    ;
    this.updateShadows(context);
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    if (!success) {
      this.endContext();
      throw new ZigError();
    }
    const finalize = () => {
      // create objects that pointers point to
      if (hasPointers) {
        this.updatePointerTargets(context, args);
      }
      this.updateShadowTargets(context);
      if (this.libc) {
        this.flushStdout?.();
      }
      this.flushConsole?.();
      this.endContext();
    };
    {
      // copy retval from shadow view
      args[COPY]?.(this.findShadowView(args[MEMORY]));
    }
    if (FINALIZE in args) {
      args[FINALIZE] = finalize;
    } else {
      finalize();
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
  ...({
    imports: {
      runThunk: { argType: 'iii', returnType: 'b' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'b' },
    },
  } ),
  ...(undefined),
});

export { callMarshalingOutbound as default };
