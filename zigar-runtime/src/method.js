import { throwZigError } from './error.js';
import { acquireTarget, updateAddress } from './pointer.js';
import { MEMORY, POINTER_VISITOR, THUNK_REPLACER } from './symbol.js';

export function addMethods(s, env) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  for (const method of staticMethods) {
    const f = createFunction(method, env, false);
    Object.defineProperty(constructor, f.name, { value: f, configurable: true, writable: true });
  }
  for (const method of instanceMembers) {
    const f = createFunction(method, env, true);
    Object.defineProperty(Object.prototype, f.name, { value: f, configurable: true, writable: true });
  }
}

export function invokeThunk(thunk, args, env) {
  // create an object where information concerning pointers can be stored
  env.startContext();
  // copy addresses of garbage-collectible objects into memory
  args[POINTER_VISITOR](updateAddress, {});
  const err = thunk.call(env, args[MEMORY]);
  args[POINTER_VISITOR](acquireTarget, { vivificate: true });
  // restore the previous context if there's one
  env.endContext();

  // errors returned by exported Zig functions are normally written into the
  // argument object and get thrown when we access its retval property (a zig error union)
  // error strings returned by the thunk are due to problems in the thunking process
  // (i.e. bugs in export.zig)
  if (err) {
    /* WASM-ONLY */
    if (err instanceof Promise) {
      // a promise of the function having been linked and called
      return err.then(() => args.retval);
    }
    /* WASM-ONLY-END */
    throwZigError(err);
  }
  return args.retval;
}

export function invokeThunkNP(thunk, args, env) {
  const err = thunk.call(env, args[MEMORY]);
  if (err) {
    /* WASM-ONLY */
    if (err instanceof Promise) {
      return err.then(() => args.retval);
    }
    /* WASM-ONLY-END */
    throwZigError(err);
  }
  return args.retval;
}

function createFunction(method, env, pushThis) {
  let { name,  argStruct, thunk } = method;
  const { constructor, hasPointer } = argStruct;
  let f;
  if (hasPointer) {
    if (pushThis) {
      f = function(...args) {
        return invokeThunk(thunk, new constructor([ this, ...args ]), env);
      }
    } else {
      f = function(...args) {
        return invokeThunk(thunk, new constructor(args), env);
      }
    }
  } else {
    if (pushThis) {
      f = function(...args) {
        return invokeThunkNP(thunk, new constructor([ this, ...args ]), env);
      }
    } else {
      f = function(...args) {
        return invokeThunkNP(thunk, new constructor(args), env);
      }
    }
  }
  /* NODE-ONLY */
  // need to set the local variables as well as the property of the method object
  /* c8 ignore next */
  f[THUNK_REPLACER] = r => thunk = argStruct = method.thunk = r;
  /* NODE-ONLY-END */
  Object.defineProperty(f, 'name', { value: name, writable: false });
  return f;
}