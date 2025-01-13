import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { PreviouslyFreed, TypeMismatch } from '../errors.js';
import { ALIGN, MEMORY, TYPE, ZIG } from '../symbols.js';
import { encodeText, usizeInvalid } from '../utils.js';

export default mixin({
  defineAlloc() {
    return {
      value(len, align = 1) {
        const ptrAlign = 31 - Math.clz32(align);
        const { vtable: { alloc }, ptr } = this;
        const slicePtr = alloc(ptr, len, ptrAlign, 0);
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
    return {
      value(arg) {
        const { dv, align } = getMemory(arg)
        const zig = dv?.[ZIG];
        if (!zig) {
          throw new TypeMismatch('object containing allocated Zig memory', arg);
        }
        const { address } = zig;
        if (address === usizeInvalid) {
          throw new PreviouslyFreed(arg);
        }
        const ptrAlign = 31 - Math.clz32(align);
        const { vtable: { free }, ptr } = this;
        free(ptr, dv, ptrAlign, 0);
        zig.address = usizeInvalid;
      }
    };
  },
  defineDupe() {
    const copy = this.getCopyFunction();
    return {
      value(arg) {
        const { dv: src, align, constructor } = getMemory(arg);
        if (!src) {
          throw new TypeMismatch('string, DataView, typed array, or Zig object', arg);
        }
        const dest = this.alloc(src.byteLength, align);
        copy(dest, src);
        return (constructor) ? constructor(dest) : dest;
      }
    };
  }
});

function getMemory(arg) {
  let dv, align = 1, constructor = null;
  if (arg instanceof DataView) {
    dv = arg;
    const fixedMemoryAlign = dv?.[ZIG]?.align;
    if (fixedMemoryAlign) {
      align = fixedMemoryAlign;
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