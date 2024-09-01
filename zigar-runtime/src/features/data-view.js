import { mixin } from '../class.js';
import {
  ArrayLengthMismatch, BufferExpected, BufferSizeMismatch
} from '../error.js';
import {
  COPIER, FIXED,
  MEMORY
} from '../symbol.js';

export default mixin({
  viewMap: new Map(),

  extractView(structure, arg, required = true) {
    const { type, byteSize, typedArray } = structure;
    let dv;
    // not using instanceof just in case we're getting objects created in other contexts
    const tag = arg?.[Symbol.toStringTag];
    if (tag === 'DataView') {
      // capture relationship between the view and its buffer
      dv = this.registerView(arg);
    } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
      dv = this.obtainView(arg, 0, arg.byteLength);
    } else if (typedArray && tag === typedArray.name || (tag === 'Uint8ClampedArray' && typedArray === Uint8Array)) {
      dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
    } else if (tag === 'Uint8Array' && typeof(Buffer) === 'function' && arg instanceof Buffer) {
      dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
    } else {
      const memory = arg?.[MEMORY];
      if (memory) {
        // arg a Zig data object
        const { constructor, instance: { members: [ member ] } } = structure;
        if (arg instanceof constructor) {
          // same type, no problem
          return memory;
        } else {
          if (isArrayLike(type)) {
            // make sure the arg has the same type of elements
            const { byteSize: elementSize, structure: { constructor: Child } } = member;
            const number = findElements(arg, Child);
            if (number !== undefined) {
              if (type === StructureType.Slice || number * elementSize === byteSize) {
                return memory;
              } else {
                throw new ArrayLengthMismatch(structure, null, arg);
              }
            }
          }
        }
      }
    }
    if (dv && byteSize !== undefined) {
      checkDataViewSize(dv, structure);
    }
    if (required && !dv) {
      throw new BufferExpected(structure);
    }
    return dv;
  },
  assignView(target, dv, structure, copy, fixed, handlers) {
    const { byteSize, type, sentinel } = structure;
    const elementSize = byteSize ?? 1;
    if (!target[MEMORY]) {
      const { shapeDefiner } = handlers;
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
      const len = dv.byteLength / elementSize;
      const source = { [MEMORY]: dv };
      sentinel?.validateData(source, len);
      if (fixed) {
        // need to copy when target object is in fixed memory
        copy = true;
      }
      shapeDefiner.call(target, copy ? null : dv, len, fixed);
      if (copy) {
        target[COPIER](source);
      }
    } else {
      const byteLength = (type === StructureType.Slice) ? elementSize * target.length : elementSize;
      if (dv.byteLength !== byteLength) {
        throw new BufferSizeMismatch(structure, dv, target);
      }
      const source = { [MEMORY]: dv };
      sentinel?.validateData(source, target.length);
      target[COPIER](source);
    }
  },
  findViewAt(buffer, offset, len) {
    let entry = this.viewMap.get(buffer);
    let existing;
    if (entry) {
      if (entry instanceof DataView) {
        // only one view created thus far--see if that's the matching one
        if (entry.byteOffset === offset && entry.byteLength === len) {
          existing = entry;
        } else {
          // no, need to replace the entry with a hash keyed by `offset:len`
          const prev = entry;
          const prevKey = `${prev.byteOffset}:${prev.byteLength}`;
          entry = { [prevKey]: prev };
          this.viewMap.set(buffer, entry);
        }
      } else {
        existing = entry[`${offset}:${len}`];
      }
    }
    return { existing, entry };
  },
  obtainView(buffer, offset, len) {
    const { existing, entry } = this.findViewAt(buffer, offset, len);
    let dv;
    if (existing) {
      return existing;
    } else if (entry) {
      dv = entry[`${offset}:${len}`] = new DataView(buffer, offset, len);
    } else {
      // just one view of this buffer for now
      this.viewMap.set(buffer, dv = new DataView(buffer, offset, len));
    }
    const fixed = buffer[FIXED];
    if (fixed) {
      // attach address to view of fixed buffer
      dv[FIXED] = { address: add(fixed.address, offset), len };
    }
    return dv;
  },
  registerView(dv) {
    if (!dv[FIXED]) {
      const { buffer, byteOffset, byteLength } = dv;
      const { existing, entry } = this.findViewAt(buffer, byteOffset, byteLength);
      if (existing) {
        // return existing view instead of this one
        return existing;
      } else if (entry) {
        entry[`${byteOffset}:${byteLength}`] = dv;
      } else {
        this.viewMap.set(buffer, dv);
      }
    }
    return dv;
  },
  getViewAddress(dv) {
    const fixed = dv[FIXED];
    if (fixed) {
      return fixed.address;
    } else {
      const address = this.getBufferAddress(dv.buffer);
      return add(address, dv.byteOffset);
    }
  },
  captureView(address, len, copy) {
    if (copy) {
      // copy content into reloctable memory
      const dv = this.allocateRelocMemory(len, 0);
      if (len > 0) {
        this.copyBytes(dv, address, len);
      }
      return dv;
    } else {
      // link into fixed memory
      return this.obtainFixedView(address, len);
    }
  },
  castView(address, len, copy, structure) {
    const { constructor, hasPointer } = structure;
    const dv = this.captureView(address, len, copy);
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(object);
    }
    if (copy) {
      object[WRITE_DISABLER]();
    }
    return object;
  },
  ...(process.env.TARGET === 'wasm' ? {
    allocateRelocMemory(len, align) {
      // alignment doesn't matter since memory always needs to be shadowed
      return this.obtainView(new ArrayBuffer(len), 0, len);
    },
  } : process.env.TARGET === 'node' ? {
    allocateRelocMemory(len, align) {
      // allocate extra memory for alignment purpose when align is larger than the default
      const extra = (align > defaultAlign && this.getBufferAddress) ? align : 0;
      const buffer = new ArrayBuffer(len + extra);
      let offset = 0;
      if (extra) {
        const address = this.getBufferAddress(buffer);
        const aligned = getAlignedAddress(address, align);
        offset = aligned - address;
      }
      return this.obtainView(buffer, Number(offset), len);
    },
  } : undefined),
});

export function isNeededByStructure(structure) {
  return true;
}

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternStruct: 3,
  PackedStruct: 4,
  ArgStruct: 5,
  VariadicStruct: 6,
  ExternUnion: 7,
  BareUnion: 8,
  TaggedUnion: 9,
  ErrorUnion: 10,
  ErrorSet: 11,
  Enum: 12,
  Optional: 13,
  SinglePointer: 14,
  SlicePointer: 15,
  MultiPointer: 16,
  CPointer: 17,
  Slice: 18,
  Vector: 19,
  Opaque: 20,
  Function: 21,
};
const structureNames = Object.keys(StructureType);

export function getStructureName(type) {
  const name = structureNames[type];
  if (!name) {
    return;
  }
  return name.replace(/\B[A-Z]/g, m => ` ${m}`).toLowerCase();
}

export function isValueExpected(structure) {
  switch (structure?.type) {
    case StructureType.Primitive:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
    case StructureType.Enum:
    case StructureType.ErrorSet:
      return true;
    default:
      return false;
  }
}

function checkDataViewSize(dv, structure) {
  const { byteSize, type } = structure;
  const isSizeMatching = type === StructureType.Slice
  ? dv.byteLength % byteSize === 0
  : dv.byteLength === byteSize;
  if (!isSizeMatching) {
    throw new BufferSizeMismatch(structure, dv);
  }
}

function findElements(arg, Child) {
  // casting to a array/slice
  const { constructor: Arg } = arg;
  if (Arg === Child) {
    // matching object
    return 1;
  } else if (Arg.child === Child) {
    // matching slice/array
    return arg.length;
  }
}

function isArrayLike(type) {
  return type === StructureType.Array || type === StructureType.Vector || type === StructureType.Slice;
}

const defaultAlign = [ 'arm64', 'ppc64', 'x64', 's390x' ].includes(process.arch) ? 16 : /* c8 ignore next */ 8;
