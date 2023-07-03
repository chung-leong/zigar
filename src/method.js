import { MEMORY, SLOTS, ZIG } from './symbol.js';
import { throwZigError } from './error.js';

export function attachMethods(s) {
  const {
    constructor,
    methods,
  } = s;
  for (const method of methods) {
    const {
      name,
      argStruct,
      thunk,
      isStaticOnly,
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor();
      for (const [ index, arg ] of args.entries()) {
        if (arg !== undefined) {
          a[index] = arg;
        }
      }
      invokeThunk(thunk, a);
      return a.retval;
    }
    Object.defineProperties(f, {
      name: { value: name, writable: false },
    });
    Object.defineProperties(constructor, {
      [name]: { value: f, configurable: true, enumerable: true, writable: true },
    });
    if (!isStaticOnly) {
      const m = function(...args) {
        const { constructor } = argStruct;
        const a = new constructor();
        a[0] = this;
        for (const [ index, arg ] of args.entries()) {
          if (arg !== undefined) {
            a[index + 1] = arg;
          }
        }
        invokeThunk(thunk, a);
        return a.retval;
      }
      Object.defineProperties(m, {
        name: { value: name, writable: false },
      });
      Object.defineProperties(constructor.prototype, {
        [name]: { value: m, configurable: true, writable: true },
      });
    }
  }
}

const globalSlots = {};

export function invokeThunk(thunk, args) {
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
}
