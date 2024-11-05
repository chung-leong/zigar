import { mixin } from '../environment.js';
import { AlignmentConflict } from '../errors.js';
import { ALIGN, CACHE, COPY, FALLBACK, MEMORY, RESTORE, ZIG } from '../symbols.js';
import {
  adjustAddress, alignForward, defineProperty, findSortedIndex, isInvalidAddress, isMisaligned,
  usizeInvalid
} from '../utils.js';

export default mixin({
  emptyBuffer: new ArrayBuffer(0),
  emptyBufferMap: new Map,

  getShadowAddress(context, target, cluster) {
    if (cluster) {
      const dv = target[MEMORY];
      if (cluster.address === undefined) {
        const shadow = this.createClusterShadow(context, cluster);
        cluster.address = this.getViewAddress(shadow[MEMORY]);
      }
      return adjustAddress(cluster.address, dv.byteOffset - cluster.start);
    } else {
      const shadow = this.createShadow(context, target);
      return this.getViewAddress(shadow[MEMORY]);
    }
  },
  createShadow(context, object) {
    const dv = object[MEMORY]
    // use the alignment of the structure; in the case of an opaque pointer's target,
    // try to the alignment specified when the memory was allocated
    const align = object.constructor[ALIGN] ?? dv[ALIGN];
    const shadow = Object.create(object.constructor.prototype);
    shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    return this.addShadow(context, shadow, object, align);
  },
  addShadow(context, shadow, object, align) {
    const shadowMap = context.shadowMap ??= new Map();
    if (process.env.TARGET === 'wasm') {
      defineProperty(shadow, RESTORE, this.defineRestorer(false));
    }
    shadowMap.set(shadow, object);
    this.registerMemory(context, shadow[MEMORY], object[MEMORY], align);
    return shadow;
  },
  findShadow(context, object) {
    const { shadowMap } = context;
    for (const [ shadow, shadowObject ] of shadowMap) {
      if (object === shadowObject) {
        return shadow;
      }
    }
  },
  removeShadow(context, dv) {
    const { shadowMap } = context;
    if (shadowMap) {
      for (const [ shadow ] of shadowMap) {
        if (shadow[MEMORY] === dv) {
          shadowMap.delete(shadow);
          break;
        }
      }
    }
  },
  createClusterShadow(context, cluster) {
    const { start, end, targets } = cluster;
    // look for largest align
    let maxAlign = 0, maxAlignOffset;
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      const align = target.constructor[ALIGN] ?? dv[ALIGN];
      if (maxAlign === undefined || align > maxAlign) {
        maxAlign = align;
        maxAlignOffset = offset;
      }
    }
    // ensure the shadow buffer is large enough to accommodate necessary adjustments
    const len = end - start;
    const unalignedShadowDV = this.allocateShadowMemory(len + maxAlign, 1);
    const unalignedAddress = this.getViewAddress(unalignedShadowDV);
    const maxAlignAddress = alignForward(adjustAddress(unalignedAddress, maxAlignOffset - start), maxAlign);
    const shadowAddress = adjustAddress(maxAlignAddress, start - maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(adjustAddress(shadowAddress, offset - start), align)) {
          throw new AlignmentConflict(align, maxAlign);
        }
      }
    }
    // placeholder object type
    const prototype = defineProperty({}, COPY, this.defineCopier(len));
    const source = Object.create(prototype);
    const shadow = Object.create(prototype);
    source[MEMORY] = new DataView(targets[0][MEMORY].buffer, Number(start), len);
    shadow[MEMORY] = shadowDV;
    if (process.env.TARGET === 'wasm') {
      // attach Zig memory info to aligned data view so it gets freed correctly
      shadowDV[ZIG] = { address: shadowAddress, len, align: 1, unalignedAddress, type: MemoryType.Scratch };
    }
    return this.addShadow(context, shadow, source, 1);
  },
  updateShadows(context) {
    const { shadowMap } = context;
    if (shadowMap) {
      for (const [ shadow, object ] of shadowMap) {
        shadow[COPY](object);
      }
    }
  },
  updateShadowTargets(context) {
    const { shadowMap } = context;
    if (shadowMap) {
      for (const [ shadow, object ] of shadowMap) {
        object[COPY](shadow);
      }
    }
  },
  releaseShadows(context) {
    const { shadowMap } = context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow ] of shadowMap) {
      this.freeShadowMemory(shadow[MEMORY]);
    }
  },
  registerMemory(context, dv, targetDV = null, targetAlign = undefined) {
    const { memoryList } = context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV, targetAlign });
    return address;
  },
  unregisterMemory(context, address) {
    const { memoryList } = context;
    const index = findMemoryIndex(memoryList, address);
    const entry = memoryList[index - 1];
    if (entry?.address === address) {
      memoryList.splice(index - 1, 1);
      return entry.dv;
    }
  },
  findMemory(context, address, count, size) {
    if (isInvalidAddress(address)) {
      if (!count) {
        address = 0;
      } else {
        return null;
      }
    } else if (!address && count) {
      return null;
    }
    let len = count * (size ?? 0);
    // check for null address (=== can't be used since address can be both number and bigint)
    if (context) {
      // see if the address points to the call context; if so, we need to retain the context
      // because a copy of the allocator is stored in a returned structure
      if (size === undefined && context.id === address) {
        context.retained = true;
      }
      const { memoryList } = context;
      const index = findMemoryIndex(memoryList, address);
      const entry = memoryList[index - 1];
      if (entry?.address === address && entry.len === len) {
        return entry.targetDV ?? entry.dv;
      } else if (entry?.address <= address && address < adjustAddress(entry.address, entry.len)) {
        const offset = Number(address - entry.address);
        const targetDV = entry.targetDV ?? entry.dv;
        const isOpaque = size === undefined;
        if (isOpaque) {
          len = targetDV.byteLength - offset;
        }
        const dv = this.obtainView(targetDV.buffer, targetDV.byteOffset + offset, len);
        if (isOpaque) {
          // opaque structure--need to save the alignment
          dv[ALIGN] = entry.targetAlign;
        }
        return dv;
      }
    }
    // not found in any of the buffers we've seen--assume it's Zig memory
    return this.obtainZigView(address, len);
  },
  allocateZigMemory(len, align, type = MemoryType.Normal) {
    const address = (len) ? this.allocateExternMemory(type, len, align) : 0;
    const dv = this.obtainZigView(address, len);
    dv[ZIG].align = align;
    dv[ZIG].type = type;
    return dv;
  },
  freeZigMemory(dv) {
    const { address, unalignedAddress, len, align, type } = dv[ZIG];
    if (len) {
      this.freeExternMemory(type, unalignedAddress ?? address, len, align);
    }
  },
  obtainZigView(address, len) {
    let dv;
    if (address && len) {
      dv = this.obtainExternView(address, len);
    } else {
      // pointer to nothing
      dv = this.emptyBufferMap.get(address);
      if (!dv) {
        dv = new DataView(this.emptyBuffer);
        dv[ZIG] = { address, len: 0 };
        this.emptyBufferMap.set(address, dv);
      }
    }
    return dv;
  },
  releaseZigView(dv) {
    const zig = dv[ZIG];
    const address = zig?.address;
    if (address && address !== usizeInvalid) {
      // try to free memory through the allocator from which it came
      zig?.free?.();
      // set address to invalid to avoid double free
      zig.address = usizeInvalid;
      if (!zig.len) {
        // remove view from empty buffer map
        this.emptyBufferMap.delete(address);
      }
    }
  },
  getViewAddress(dv) {
    const zig = dv[ZIG];
    if (zig) {
      return zig.address;
    } else {
      const address = this.getBufferAddress(dv.buffer);
      return adjustAddress(address, dv.byteOffset);
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      allocateExternMemory: { argType: 'iii', returnType: 'i' },
      freeExternMemory: { argType: 'iiii' },
    },
    exports: {
      getViewAddress: { argType: 'v', returnType: 'i' },
    },

    allocateShadowMemory(len, align) {
      return this.allocateZigMemory(len, align, MemoryType.Scratch);
    },
    freeShadowMemory(dv) {
      return this.freeZigMemory(dv);
    },
    obtainExternView(address, len) {
      const { buffer } = this.memory;
      return this.obtainView(buffer, address, len);
    },
    getTargetAddress(context, target, cluster) {
      const dv = target[MEMORY];
      if (dv[ZIG]) {
        return this.getViewAddress(dv);
      } else if (dv.byteLength === 0) {
        // it's a null pointer/empty slice
        return 0;
      }
      // relocatable buffers always need shadowing
    },
    getBufferAddress(buffer) {
      if (process.env.DEV) {
        if (buffer !== this.memory.buffer) {
          throw new Error('Cannot obtain address of relocatable buffer');
        }
      }
      return 0;
    },
    defineRestorer(updateCache = true) {
      const thisEnv = this;
      return {
        value() {
          const dv = this[MEMORY];
          const zig = dv?.[ZIG];
          if (zig && zig.len > 0 && dv.buffer.byteLength === 0) {
            const newDV = thisEnv.obtainZigView(zig.address, zig.len);
            if (zig.align) {
              newDV[ZIG].align = zig.align;
            }
            this[MEMORY] = newDV;
            if (updateCache) {
              this.constructor[CACHE]?.save?.(newDV, this);
            }
            return true;
          } else {
            return false;
          }
        },
      }
    },
    copyExternBytes(dst, address, len) {
      const { memory } = this;
      const src = new DataView(memory.buffer, address, len);
      const copy = this.getCopyFunction(len);
      copy(dst, src);
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      allocateExternMemory: null,
      freeExternMemory: null,
      getBufferAddress: null,
      copyExternBytes: null,
      obtainExternBuffer: null,
    },
    exports: {
      getViewAddress: null,
    },

    allocateShadowMemory(len, align) {
      // Node can read into JavaScript memory space so we can keep shadows there
      return this.allocateJSMemory(len, align);
    },
    freeShadowMemory(dv) {
      // nothing needs to happen
    },
    createShadowView(dv) {
      // create a fake zig view for bypassing pointer check
      const address = this.getViewAddress(dv);
      const len = dv.byteLength;
      const shadowDV = new DataView(dv.buffer, dv.byteOffset, len);
      shadowDV[ZIG] = { address, len };
      return shadowDV;
    },
    obtainExternView(address, len) {
      const buffer = this.obtainExternBuffer(address, len, FALLBACK);
      buffer[ZIG] = { address, len };
      return this.obtainView(buffer, 0, len);
    },
    getTargetAddress(context, target, cluster) {
      const dv = target[MEMORY];
      if (cluster) {
        // pointer is pointing to buffer with overlapping views
        if (cluster.misaligned === undefined) {
          const address = this.getBufferAddress(dv.buffer);
          // ensure that all pointers are properly aligned
          for (const target of cluster.targets) {
            const offset = target[MEMORY].byteOffset;
            const align = target.constructor[ALIGN];
            const viewAddress = adjustAddress(address, offset);
            if (isMisaligned(viewAddress, align)) {
              cluster.misaligned = true;
              break;
            }
          }
          if (cluster.misaligned === undefined)  {
            cluster.misaligned = false;
            cluster.address = address;
          }
        }
        if (!cluster.misaligned) {
          return adjustAddress(cluster.address, dv.byteOffset);
        }
      } else {
        const align = target.constructor[ALIGN];
        const address = this.getViewAddress(dv);
        if (!isMisaligned(address, align)) {
          this.registerMemory(context, dv);
          return address;
        }
      }
      // need shadowing
    },
    /* c8 ignore next */
  } : undefined),
});

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

export const MemoryType = {
  Normal: 0,
  Scratch: 1,
};
