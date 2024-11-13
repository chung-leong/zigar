import { VisitorFlag } from "../constants";
import { mixin } from '../environment.js';
import { SLOTS, VISIT, VIVIFICATE } from "../symbols";

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
    if (flags & VisitorFlag.Vivificate) {
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
  copy({ source }) {
    const target = source[SLOTS][0];
    if (target) {
      this[TARGET] = target;
    }
  },
  reset({ isActive }) {
    if (this[SLOTS][0] && !isActive(this)) {
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
