import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { InaccessiblePointer } from '../errors.js';
import { POINTER, SLOTS, TARGET, VISIT, VIVIFICATE } from '../symbols.js';
import { defineProperties } from '../utils.js';

export default mixin({
  defineVisitor() {
    return {
      value(cb, flags, src) {
        let fn;
        if (typeof(cb) === 'string') {
          fn = builtinVisitors[cb];
          if (process.env.DEV) {
            if (!fn) {
              throw new Error(`Unrecognized visitor: ${cb}`);
            }
          }
        } else {
          fn = cb;
          if (process.env.DEV) {
            if (typeof(fn) !== 'function') {
              throw new Error(`Invalid visitor: ${cb}`);
            }
          }
        }
        fn.call(this, flags, src);
      }
    };
  },
});

export function visitChild(slot, cb, flags, src) {
  let child = this[SLOTS][slot];
  if (!child) {
    if (!(flags & VisitorFlag.IgnoreUncreated)) {
      child = this[VIVIFICATE](slot);
    } else {
      return;
    }
  }
  let srcChild;
  if (src) {
    srcChild = src[SLOTS][slot];
    if (!srcChild) {
      return;
    }
  }
  child[VISIT](cb, flags, srcChild);
}

function throwInaccessible() {
  throw new InaccessiblePointer();
};

const builtinVisitors = {
  copy(flags, src) {
    const target = src[SLOTS][0];
    if (target) {
      this[TARGET] = target;
    }
  },
  reset(flags) {
    if (flags & VisitorFlag.IsInactive) {
      this[SLOTS][0] = undefined;
    }
  },
  disable() {
    const disabledProp = { get: throwInaccessible, set: throwInaccessible };
    defineProperties(this[POINTER], {
      '*': disabledProp,
      '$': disabledProp,
      [POINTER]: disabledProp,
      [TARGET]: disabledProp,
    });
  },
};
