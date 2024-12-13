import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { SLOTS, VISIT, VIVIFICATE } from '../symbols.js';

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

const builtinVisitors = {
  copy(flags, src) {
    this[SLOTS][0] = src[SLOTS][0];
  },
  reset(flags) {
    if (flags & VisitorFlag.IsInactive) {
      this[SLOTS][0] = undefined;
    }
  },
};
