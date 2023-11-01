import { throwZigError } from './error.js';
import { acquireTarget, updateAddress } from './pointer.js';
import { MEMORY, POINTER_VISITOR, RELEASE_THUNK } from './symbol.js';

export function addMethods(s, env) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  const Environment = env.constructor;
  for (const method of staticMethods) {
    let {
      name,
      argStruct,
      thunk
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor(args);
      return invokeThunk(thunk, a, Environment);
    };
    if (process.env.ZIGAR_TARGET === 'NODE-CPP-EXT') {
      // need to set the local variables as well as the property of the method object
      /* c8 ignore next */
      f[RELEASE_THUNK] = r => thunk = argStruct = method.thunk = r;
    }
    Object.defineProperty(f, 'name', { value: name, writable: false });
    Object.defineProperty(constructor, name, { value: f, configurable: true, writable: true });
  }
  for (const method of instanceMembers) {
    let {
      name,
      argStruct,
      thunk,
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor([ this, ...args ]);
      return invokeThunk(thunk, a, Environment);
    };
    if (process.env.ZIGAR_TARGET === 'NODE-CPP-EXT') {
      /* c8 ignore next */
      f[RELEASE_THUNK] = r => thunk = argStruct = method.thunk = r;
    }
    Object.defineProperty(f, 'name', { value: name, writable: false });
    Object.defineProperty(Object.prototype, name, { value: f, configurable: true, writable: true });
  }
}

export function invokeThunk(thunk, args, Environment) {
  args[POINTER_VISITOR]?.(updateAddress, {});
  const env = new Environment;
  const err = thunk.call(env, args[MEMORY]);
  args[POINTER_VISITOR]?.(acquireTarget, { vivificate: true });

  // errors returned by exported Zig functions are normally written into the
  // argument object and get thrown when we access its retval property (a zig error union)
  // error strings returned by the thunk are due to problems in the thunking process
  // (i.e. bugs in export.zig)
  if (err) {
    if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
      if (err instanceof Promise) {
        // a promise of the function having been linked and called
        return err.then(() => args.retval);
      }
    }
    throwZigError(err);
  }
  return args.retval;
}
