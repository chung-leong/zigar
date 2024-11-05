import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY, ZIG } from '../symbols.js';
import { encodeText } from '../utils.js';

export default mixin({
  defineAlloc() {
    return {
      value(len, align) {
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
        let src;
        if (typeof(arg) === 'string') {
          arg = encodeText(arg);
        }
        if (arg instanceof DataView) {
          src = arg;
        } else if (arg instanceof ArrayBuffer) {
          src = new DataView(arg);
        } else if (arg) {
          const { buffer, byteOffset, byteLength } = arg;
          if (buffer && byteOffset !== undefined && byteLength !== undefined) {
            src = new DataView(buffer, byteOffset, byteLength);
          }
        }
        if (!src) {
          throw new TypeMismatch('string, DataView, or typed array', arg);
        }
        const dv = this.alloc(src.byteLength, 8);
        copy(dv, src);
        return dv;
      }
    };
  }
});

