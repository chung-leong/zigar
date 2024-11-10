import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY, ZIG } from '../symbols.js';
import { encodeText } from '../utils.js';

var allocatorMethods = mixin({
  defineAlloc() {
    return {
      value(len, align = 1) {
        const ptrAlign = 31 - Math.clz32(align);
        const { vtable, ptr } = this;
        const slicePtr = vtable.alloc(ptr, len, ptrAlign, 0);
        // alloc returns a [*]u8, which has a initial length of 1
        slicePtr.length = len;
        const dv = slicePtr['*'][MEMORY];
        const zig = dv[ZIG];
        if (zig) {
          zig.free = () => vtable.free(ptr, slicePtr, ptrAlign, 0);
        }
        return dv;
      }
    };
  },
  defineFree(dv) {
    return {
      value(dv) {
        const zig = dv[ZIG];
        const f = zig?.free;
        if (!f) {
          throw new TypeMismatch('DataView object from alloc()', dv);
        }
        f();
      }
    };
  },
  defineDupe() {
    const copy = this.getCopyFunction();
    return {
      value(arg) {
        let src, align;
        if (typeof(arg) === 'string') {
          arg = encodeText(arg);
        }
        if (arg instanceof DataView) {
          src = arg;
        } else if (arg instanceof ArrayBuffer) {
          src = new DataView(arg);
        } else if (arg) {
          const { buffer, byteOffset, byteLength, BYTES_PER_ELEMENT } = arg;
          if (buffer && byteOffset !== undefined && byteLength !== undefined) {
            src = new DataView(buffer, byteOffset, byteLength);
            align = BYTES_PER_ELEMENT;
          }
        }
        if (!src) {
          throw new TypeMismatch('string, DataView, or typed array', arg);
        }
        const dv = this.alloc(src.byteLength, align);
        copy(dv, src);
        return dv;
      }
    };
  }
});

export { allocatorMethods as default };
