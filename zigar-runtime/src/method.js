import { throwZigError } from './error.js';
import { MEMORY, SLOTS, ZIG, RELEASE_THUNK } from './symbol.js';

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
      f[RELEASE_THUNK] = r => thunk = argStruct = method.thunk = r;
    }
    Object.defineProperty(f, 'name', { value: name, writable: false });
    Object.defineProperty(Object.prototype, name, { value: f, configurable: true, writable: true });
  }
}

const globalSlots = {};

export function invokeThunk(thunk, args) {
  if (process.env.ZIGAR_TARGET === 'NODE-CPP-EXT') {
    // pass the argument object as the this/recv variable
    // while the slots and symbols are passed as arguments
    const err = thunk.call(args, globalSlots, SLOTS, MEMORY, ZIG);
    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throwZigError(err);
    }
  } else if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
    const res = thunk(args);
    if (res !== undefined) {
      if (res instanceof Promise) {
        // a promise of the function having been linked and called
        return res.then(() => args.retval);
      } else {
        throwZigError(res);
      }
    }
    /* c8 ignore next 3 */
  } else {
    throw new Error(`Unknown target: ${process.env.ZIGAR_TARGET}`);
  }
  return args.retval;
}
