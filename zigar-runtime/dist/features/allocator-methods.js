import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch, PreviouslyFreed } from '../errors.js';
import { ZIG, MEMORY, TYPE, ALIGN } from '../symbols.js';
import { copyView, usizeInvalid, encodeText } from '../utils.js';

var allocatorMethods = mixin({
  defineAlloc() {
    return {
      value(len, align = 1) {
        const lz = Math.clz32(align);        
        if (align !== 1 << (31 - lz)) {
          throw new Error(`Invalid alignment: ${align}`);
        }
        const ptrAlign = 31 - lz;
        const { vtable: { alloc }, ptr } = this;
        const slicePtr = alloc(ptr, len, ptrAlign, 0);
        if (!slicePtr) {
          throw new Error('Out of memory');
        }
        // alloc returns a [*]u8, which has a initial length of 1
        slicePtr.length = len;
        const dv = slicePtr['*'][MEMORY];
        // attach alignment so we can find it again
        dv[ZIG].align = align;
        return dv;
      }
    };
  },
  defineFree() {
    const thisEnv = this;
    return {
      value(arg) {
        const { dv, align } = getMemory(arg);
        const zig = dv?.[ZIG];
        if (!zig) {
          throw new TypeMismatch('object containing allocated Zig memory', arg);
        }
        const { address } = zig;
        if (address === usizeInvalid) {
          throw new PreviouslyFreed(arg);
        }
        const { vtable: { free }, ptr } = this;
        const ptrAlign = 31 - Math.clz32(align);        
        free(ptr, dv, ptrAlign, 0);
        thisEnv.releaseZigView(dv);
      }
    };
  },
  defineDupe() {
    return {
      value(arg) {
        const { dv: src, align, constructor } = getMemory(arg);
        if (!src) {
          throw new TypeMismatch('string, DataView, typed array, or Zig object', arg);
        }
        const dest = this.alloc(src.byteLength, align);
        copyView(dest, src);
        return (constructor) ? constructor(dest) : dest;
      }
    };
  }
});

function getMemory(arg) {
  let dv, align = 1, constructor = null;
  if (arg instanceof DataView) {
    dv = arg;
    const zigMemoryAlign = dv?.[ZIG]?.align;
    if (zigMemoryAlign) {
      align = zigMemoryAlign;
    }
  } else if (arg instanceof ArrayBuffer) {
    dv = new DataView(arg);
  } else if (arg) {
    if (arg[MEMORY]) {
      if (arg.constructor[TYPE] === StructureType.Pointer) {
        arg = arg['*'];
      }
      dv = arg[MEMORY];
      constructor = arg.constructor;
      align = constructor[ALIGN];
    } else {
      if (typeof(arg) === 'string') {
        arg = encodeText(arg);
      }
      const { buffer, byteOffset, byteLength, BYTES_PER_ELEMENT } = arg;
      if (buffer && byteOffset !== undefined && byteLength !== undefined) {
        dv = new DataView(buffer, byteOffset, byteLength);
        align = BYTES_PER_ELEMENT;
      }
    }
  }
  return { dv, align, constructor };
}

export { allocatorMethods as default };
