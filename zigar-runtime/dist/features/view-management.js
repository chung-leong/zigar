import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { ArrayLengthMismatch, BufferSizeMismatch, BufferExpected } from '../errors.js';
import { TYPED_ARRAY, MEMORY, SENTINEL, SHAPE, COPY, ZIG, CONST_TARGET, CACHE, PROXY } from '../symbols.js';
import { isCompatibleInstanceOf, findElements, usizeInvalid } from '../utils.js';

var viewManagement = mixin({
  viewMap: null,

  extractView(structure, arg, onError = throwError) {
    const { type, byteSize, constructor } = structure;
    let dv;
    // not using instanceof just in case we're getting objects created in other contexts
    const tag = arg?.[Symbol.toStringTag];
    if (tag) {
      if (tag === 'DataView') {
        // capture relationship between the view and its buffer
        dv = this.registerView(arg);
      } else if (tag === 'ArrayBuffer') {
        dv = this.obtainView(arg, 0, arg.byteLength);
      } else if ((tag && tag === constructor[TYPED_ARRAY]?.name) || (tag === 'Uint8ClampedArray' && constructor[TYPED_ARRAY] === Uint8Array)) {
        dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
      } else ;
    }
    if (!dv) {
      const memory = arg?.[MEMORY];
      if (memory) {
        // arg a Zig data object
        const { constructor, instance: { members: [ member ] } } = structure;
        if (isCompatibleInstanceOf(arg, constructor)) {
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
    if (dv) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
    } else {
      onError?.(structure, arg);
    }
    return dv;
  },
  assignView(target, dv, structure, copy, allocator) {
    const { byteSize, type } = structure;
    const elementSize = byteSize ?? 1;
    if (!target[MEMORY]) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
      const len = dv.byteLength / elementSize;
      const source = { [MEMORY]: dv };
      target.constructor[SENTINEL]?.validateData?.(source, len);
      if (allocator) {
        // need to copy when target object is in Zig memory
        copy = true;
      }
      target[SHAPE](copy ? null : dv, len, allocator);
      if (copy) {
        target[COPY](source);
      }
    } else {
      const byteLength = (type === StructureType.Slice) ? elementSize * target.length : elementSize;
      if (dv.byteLength !== byteLength) {
        throw new BufferSizeMismatch(structure, dv, target);
      }
      const source = { [MEMORY]: dv };
      target.constructor[SENTINEL]?.validateData?.(source, target.length);
      target[COPY](source);
    }
  },
  findViewAt(buffer, offset, len) {
    this.viewMap ||= new WeakMap();
    let entry = this.viewMap.get(buffer);
    let existing;
    if (entry) {
      if (entry instanceof DataView) {
        // only one view created thus far--see if that's the matching one
        if (entry.byteOffset === offset && entry.byteLength === len) {
          existing = entry;
          entry = null;
        } else {
          // no, need to replace the entry with a hash keyed by `offset:len`
          const prev = entry;
          const prevKey = `${prev.byteOffset}:${prev.byteLength}`;
          entry = new Map([ [ prevKey, prev ] ]);
          this.viewMap.set(buffer, entry);
        }
      } else {
        existing = entry.get(`${offset}:${len}`);
      }
    }
    {
      if (existing?.[ZIG]?.address === usizeInvalid) {
        // view was of previously freed memory
        existing = null;
      }
    }
    return { existing, entry };
  },
  obtainView(buffer, offset, len) {
    const { existing, entry } = this.findViewAt(buffer, offset, len);
    let dv;
    if (existing) {
      return existing;
    }
    dv = new DataView(buffer, offset, len);
    if (entry) {
      entry.set(`${offset}:${len}`, dv);
    } else {
      // just one view of this buffer for now
      this.viewMap.set(buffer, dv);
    }
    {
      if (buffer === this.memory?.buffer || buffer === this.usizeMaxBuffer) {
        dv[ZIG] = { address: offset, len };
      }
      return dv;
    }
  },
  registerView(dv) {
    if (!dv[ZIG]) {
      const { buffer, byteOffset, byteLength } = dv;
      const { existing, entry } = this.findViewAt(buffer, byteOffset, byteLength);
      if (existing) {
        // return existing view instead of this one
        return existing;
      } else if (entry) {
        entry.set(`${byteOffset}:${byteLength}`, dv);
      } else {
        this.viewMap.set(buffer, dv);
      }
    }
    return dv;
  },
  allocateMemory(len, align = 0, allocator = null) {
    return allocator?.alloc?.(len, align) ?? this.allocateJSMemory(len, align);
  },
  ...({
    allocateJSMemory(len, align) {
      // alignment doesn't matter since memory always needs to be shadowed
      return this.obtainView(new ArrayBuffer(len), 0, len);
    },
    restoreView(dv) {
      const zig = dv?.[ZIG];
      if (zig?.len > 0 && dv.buffer.byteLength === 0) {
        dv = this.obtainZigView(zig.address, zig.len);
        if (zig.align) {
          dv[ZIG].align = zig.align;
        }
      }
      return dv;
    },
    defineRestorer() {
      const thisEnv = this;
      return {
        value() {
          const dv = this[MEMORY];
          const newDV = thisEnv.restoreView(dv);
          if (dv !== newDV) {
            const target = this[CONST_TARGET] ?? this;
            target[MEMORY] = newDV;
            // pointers are referenced by their proxies in the cache
            target.constructor[CACHE]?.save?.(newDV, target[PROXY] ?? target);
            return true;
          } else {
            return false;
          }
        },
      }
    },
  } ),
});

function checkDataViewSize(dv, structure) {
  const { byteSize, type } = structure;
  const isSizeMatching = type === StructureType.Slice
  ? dv.byteLength % byteSize === 0
  : dv.byteLength === byteSize;
  if (!isSizeMatching) {
    throw new BufferSizeMismatch(structure, dv);
  }
}

function isArrayLike(type) {
  return type === StructureType.Array || type === StructureType.Vector || type === StructureType.Slice;
}

function throwError(structure) {
  throw new BufferExpected(structure);
}

export { checkDataViewSize, viewManagement as default };
