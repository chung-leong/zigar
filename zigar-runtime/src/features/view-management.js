import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { ArrayLengthMismatch, BufferExpected, BufferSizeMismatch } from '../errors.js';
import { CACHE, FALLBACK, MEMORY, RESTORE, SENTINEL, SHAPE, TYPED_ARRAY, ZIG } from '../symbols.js';
import { adjustAddress, alignForward, copyObject, copyView, findElements, isCompatibleInstanceOf, isDetached, usizeInvalid } from '../utils.js';

export default mixin({
  init() {
    this.viewMap = new WeakMap();
    if (process.env.TARGET === 'node') {
      this.needFallback = undefined;
    }
    if (process.env.DEV) {
      this.bufferRefs = [];
    }
  },
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
      } else if (process.env.TARGET === 'node' && tag === 'Uint8Array' && arg instanceof Buffer) {
        dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
      }
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
    const source = (process.env.TARGET === 'wasm') 
    ? { [MEMORY]: dv, [RESTORE]() { return this[MEMORY] } }
    : { [MEMORY]: dv };
    if (!target[MEMORY]) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
      const len = dv.byteLength / elementSize;
      target.constructor[SENTINEL]?.validateData?.(source, len);
      if (allocator) {
        // need to copy when target object is in Zig memory
        copy = true;
      }
      target[SHAPE](copy ? null : dv, len, allocator);
      if (copy) {
        copyObject(target, source);
      }
    } else {
      const byteLength = (type === StructureType.Slice) ? elementSize * target.length : elementSize;
      if (dv.byteLength !== byteLength) {
        throw new BufferSizeMismatch(structure, dv, target);
      }
      target.constructor[SENTINEL]?.validateData?.(source, target.length);
      copyObject(target, source);
    }
    if (process.env.TARGET === 'node' && this.usingBufferFallback()) {
      const dv = target[MEMORY];
      const address = dv.buffer[FALLBACK];
      if (address !== undefined) {
        this.syncExternalBuffer(dv.buffer, address, true);
      }
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
    if (process.env.TARGET === 'wasm') {
      if (existing?.[ZIG]?.address === usizeInvalid) {
        // view was of previously freed memory
        existing = null;
      }
    }
    if (process.env.DEV) {
      if (!entry) {
        const ref = new WeakRef(buffer);
        this.bufferRefs.push(ref);
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
    if (process.env.TARGET === 'wasm') {
      if (buffer === this.memory?.buffer || buffer === this.usizeMaxBuffer) {
        dv[ZIG] = { address: offset, len };
      }
      return dv;
    } else if (process.env.TARGET === 'node') {
      const zig = buffer[ZIG];
      if (zig) {
        // attach address to view of zig buffer
        dv[ZIG] = { address: adjustAddress(zig.address, offset), len };
      }
    }
    return dv;
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
  ...(process.env.TARGET === 'wasm' ? {
    allocateJSMemory(len, align) {
      // alignment doesn't matter since memory always needs to be shadowed
      return this.obtainView(new ArrayBuffer(len), 0, len);
    },
    restoreView(dv) {
      const zig = dv?.[ZIG];
      if (isDetached(dv.buffer)) {
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
            this[MEMORY] = newDV;
            this.constructor[CACHE]?.save?.(newDV, this);
          }
          return newDV;
        },
      }
    },
    moveExternBytes(jsDV, address, to) {
      const { memory } = this;
      const len = jsDV.byteLength;
      if (len === 0) return;
      const zigDV = new DataView(memory.buffer, address, len);
      if (!(jsDV instanceof DataView)) {
        // assume it's a typed array
        jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
      }
      copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      requireBufferFallback: {},
      syncExternalBuffer: {},
      moveExternBytes: {},
    },
    usingBufferFallback() {
      if (this.needFallback === undefined) {
        this.needFallback = this.requireBufferFallback?.();
      }
      return this.needFallback;
    },
    allocateJSMemory(len, align) {
      // allocate extra memory for alignment purpose when align is larger than the default
      const extra = (align > defaultAlign && this.getBufferAddress) ? align : 0;
      const buffer = new ArrayBuffer(len + extra);
      let offset = 0;
      if (extra) {
        const address = this.getBufferAddress(buffer);
        const aligned = alignForward(address, align);
        offset = aligned - address;
      }
      return this.obtainView(buffer, Number(offset), len);
    },
    /* c8 ignore next */
  } : undefined),
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagViewManagement() {
      let total = 0, active = 0, collected = 0;
      for (const ref of this.bufferRefs) {
        total++;
        if (ref.deref()) {
          active++;
        } else {
          collected++;
        }
      }
      this.showDiagnostics('View management', [
        `Total buffer count: ${total}`,
        `Active: ${active}`,
        `Garbage-collected: ${collected}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});

export function checkDataViewSize(dv, structure) {
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

const defaultAlign = (process.env.TARGET === 'node')
? [ 'arm64', 'ppc64', 'x64', 's390x' ].includes(process.arch) ? 16 : /* c8 ignore next */ 8
: undefined;
