import { StructureType, StructFlag, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { ZigError, UndefinedArgument, adjustArgumentError, Exit } from '../errors.js';
import { ATTRIBUTES, MEMORY, FINALIZE, COPY, STRING_RETVAL, RETURN, PROMISE, GENERATOR, SETTERS, VISIT, ALLOCATOR } from '../symbols.js';

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
      // `this` is present when running a promise and generator callback received from a inbound call
      // it's going to be the argument struct of that call
      const argStruct = new ArgStruct(args, this?.[ALLOCATOR]);
      {
        try {
          return thisEnv.invokeThunk(thunk, self, argStruct);
        } catch (err) {
          // do nothing when exit code is 0
          if (err instanceof Exit && err.code === 0) {
            return;
          }
          throw err;
        }
      }
    };
    return self;
  },
  copyArguments(argStruct, argList, members, options, argAlloc) {
    let destIndex = 0, srcIndex = 0;
    let allocatorCount = 0;
    const setters = argStruct[SETTERS];
    for (const { type, structure } of members) {
      let arg, promise, generator, signal;
      if (structure.type === StructureType.Struct) {
        if (structure.flags & StructFlag.IsAllocator) {
          // use programmer-supplied allocator if found in options object, handling rare scenarios
          // where a function uses multiple allocators
          const allocator = (++allocatorCount === 1)
          ? options?.['allocator'] ?? options?.['allocator1']
          : options?.[`allocator${allocatorCount}`];
          // otherwise use default allocator which allocates relocatable memory from JS engine
          arg = allocator ?? this.createDefaultAllocator(argStruct, structure);
        } else if (structure.flags & StructFlag.IsPromise) {
          promise ||= this.createPromise(structure, argStruct, options?.['callback']);
          arg = promise;
        } else if (structure.flags & StructFlag.IsGenerator) {
          generator ||= this.createGenerator(structure, argStruct, options?.['callback']);
          arg = generator;
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          signal ||= this.createSignal(structure, options?.['signal']);
          arg = signal;
        } else if (structure.flags & StructFlag.IsReader) {
          arg = this.createReader(argList[srcIndex++]);
        } else if (structure.flags & StructFlag.IsWriter) {
          arg = this.createWriter(argList[srcIndex++]);
        }
      }
      if (arg === undefined) {
        // just a regular argument
        arg = argList[srcIndex++];
        // only void has the value of undefined
        if (arg === undefined && type !== MemberType.Void) {
          throw new UndefinedArgument();
        }
      }
      try {
        const set = setters[destIndex++];
        set.call(argStruct, arg, argAlloc);
      } catch (err) {
        throw adjustArgumentError(err, destIndex - 1);
      }
    }
  },
  invokeThunk(thunk, fn, argStruct) {
    const context = this.startContext();
    const attrs = argStruct[ATTRIBUTES];
    const thunkAddress = this.getViewAddress(thunk[MEMORY]);
    const fnAddress = this.getViewAddress(fn[MEMORY]);
    const isAsync = FINALIZE in argStruct;
    const hasPointers = VISIT in argStruct;
    if (hasPointers) {
      this.updatePointerAddresses(context, argStruct);
    }
    // return address of shadow for argumnet struct
    const argAddress = this.getShadowAddress(context, argStruct, null, false)
    ;
    // get address of attributes if function variadic
    const attrAddress = (attrs) ? this.getShadowAddress(context, attrs) : 0
    ;
    this.updateShadows(context);
    const finalize = () => {
      this.updateShadowTargets(context);
      // create objects that pointers point to
      if (hasPointers) {
        this.updatePointerTargets(context, argStruct);
      }
      if (this.libc) {
        this.flushStdout?.();
      }
      this.flushConsole?.();
      this.endContext();
    };
    if (isAsync) {
      argStruct[FINALIZE] = finalize;
    }
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    if (!success) {
      finalize();
      throw new ZigError();
    }
    {
      // copy retval from shadow view
      argStruct[COPY]?.(this.findShadowView(argStruct[MEMORY]));
    }
    if (isAsync) {
      let retval = null;
      // if a function has returned a value or failed synchronmously, the promise is resolved immediately
      try {
        retval = argStruct.retval;
      } catch (err) {
        retval = new ZigError(err, 1);
      }
      if (retval != null) {
        if (fn[STRING_RETVAL] && retval) {
          retval = retval.string;
        }
        argStruct[RETURN](retval);
      } else if (fn[STRING_RETVAL]) {
        // so the promise or generator knows that a string is wanted 
        argStruct[STRING_RETVAL] = true;
      }
      // this would be undefined if a callback function is used instead
      return argStruct[PROMISE] ?? argStruct[GENERATOR];
    } else {
      finalize();
      try {
        const { retval } = argStruct;
        return (fn[STRING_RETVAL] && retval) ? retval.string : retval;
      } catch (err) {
        throw new ZigError(err, 1);
      }
    }
  },
  ...({
    imports: {
      runThunk: { argType: 'iii', returnType: 'b' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'b' },
    },
  } ),
});

export { callMarshalingOutbound as default };
