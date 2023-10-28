import { throwZigError } from './error.js';
import { Environment } from './environment.js';
import { RELEASE_THUNK } from './symbol.js';

export function addMethods(s) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  for (const method of staticMethods) {
    let {
      name,
      argStruct,
      thunk
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor(args);
      return invokeThunk(thunk, a);
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
      return invokeThunk(thunk, a);
    };
    if (process.env.ZIGAR_TARGET === 'NODE-CPP-EXT') {
      /* c8 ignore next */
      f[RELEASE_THUNK] = r => thunk = argStruct = method.thunk = r;
    }
    Object.defineProperty(f, 'name', { value: name, writable: false });
    Object.defineProperty(Object.prototype, name, { value: f, configurable: true, writable: true });
  }
}

export function invokeThunk(thunk, args) {
  const env = new Environment;
  const err = thunk.call(env, args);
  // errors returned by exported Zig functions are normally written into the
  // argument object and get thrown when we access its retval property (a zig error union)
  // error strings returned by the thunk are due to problems in the thunking process
  // (i.e. bugs in export.zig)
  if (err) {
    if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
      if (res instanceof Promise) {
        // a promise of the function having been linked and called
        return res.then(() => args.retval);
      }
    }
    throwZigError(err);
  }
  return args.retval;
}
