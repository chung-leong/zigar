import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { SLOTS, VIVIFICATE, VISIT } from '../symbols.js';

var all = mixin({
  defineVisitor() {
    return {
      value(cb, flags, src) {
        let fn;
        if (typeof(cb) === 'string') {
          fn = builtinVisitors[cb];
        } else {
          fn = cb;
        }
        fn.call(this, flags, src);
      }
    };
  },
});

function visitChild(slot, cb, flags, src) {
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

export { all as default, visitChild };
