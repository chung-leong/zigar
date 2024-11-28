import { mixin } from '../environment.js';
import { AlignmentConflict } from '../errors.js';
import { MEMORY, ALIGN, ZIG, CACHE } from '../symbols.js';
import { alignForward, adjustAddress, isMisaligned, isInvalidAddress, usizeInvalid, findSortedIndex } from '../utils.js';

var memoryMapping = mixin({
  emptyBuffer: new ArrayBuffer(0),
  emptyBufferMap: new Map,
  memoryList: [],
  contextCount: 0,

  startContext() {
    ++this.contextCount;
    return { shadowList: [] };
  },
  endContext() {
    if (--this.contextCount === 0) {
      for (const { shadowDV } of this.memoryList) {
        if (shadowDV) {
          this.freeShadowMemory(shadowDV);
        }
      }
      this.memoryList.splice(0);
    }
  },
  getShadowAddress(context, target, cluster, writable) {
    const targetDV = target[MEMORY];
    if (cluster) {
      if (cluster.address === undefined) {
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
        const unalignedDV = this.allocateShadowMemory(len + maxAlign, 1);
        const unalignedAddress = this.getViewAddress(unalignedDV);
        const maxAlignAddress = alignForward(adjustAddress(unalignedAddress, maxAlignOffset - start), maxAlign);
        const address = adjustAddress(maxAlignAddress, start - maxAlignOffset);
        // make sure that other pointers are correctly aligned also
        for (const target of targets) {
          const dv = target[MEMORY];
          const offset = dv.byteOffset;
          if (offset !== maxAlignOffset) {
            const align = target.constructor[ALIGN] ?? dv[ALIGN];
            if (isMisaligned(adjustAddress(address, offset - start), align)) {
              throw new AlignmentConflict(align, maxAlign);
            }
          }
        }
        const shadowOffset = unalignedDV.byteOffset + Number(address - unalignedAddress);
        const shadowDV = new DataView(unalignedDV.buffer, shadowOffset, len);
        {
          // attach Zig memory info to aligned data view so it gets freed correctly
          shadowDV[ZIG] = { address, len, align: 1, unalignedAddress, type: MemoryType.Scratch };
        }
        const clusterDV = new DataView(targetDV.buffer, Number(start), len);
        const entry = this.registerMemory(address, len, 1, writable, clusterDV, shadowDV);
        context.shadowList.push(entry);
        cluster.address = address;
      }
      return adjustAddress(cluster.address, targetDV.byteOffset - cluster.start);
    } else {
      const align = target.constructor[ALIGN] ?? targetDV[ALIGN];
      const len = targetDV.byteLength;
      const shadowDV = this.allocateShadowMemory(len, align);
      const address = this.getViewAddress(shadowDV);
      const entry = this.registerMemory(address, len, 1, writable, targetDV, shadowDV);
      context.shadowList.push(entry);
      return address;
    }
  },
  updateShadows(context) {
    const copy = this.getCopyFunction();
    for (const { targetDV, shadowDV } of context.shadowList) {
      copy(shadowDV, targetDV);
    }
  },
  updateShadowTargets(context) {
    const copy = this.getCopyFunction();
    for (const { targetDV, shadowDV, writable } of context.shadowList) {
      if (writable) {
        copy(targetDV, shadowDV);
      }
    }
  },
  registerMemory(address, len, align, writable, targetDV, shadowDV) {
    const index = findMemoryIndex(this.memoryList, address);
    let entry = this.memoryList[index - 1];
    if (entry?.address === address && entry.len === len) {
      entry.writable ||= writable;
    } else {
      entry = { address, len, align, writable, targetDV, shadowDV };
      this.memoryList.splice(index, 0, entry);
    }
    return entry;
  },
  unregisterMemory(address, len) {
    const index = findMemoryIndex(this.memoryList, address);
    const entry = this.memoryList[index - 1];
    if (entry?.address === address && entry.len === len) {
      this.memoryList.splice(index - 1, 1);
      return entry;
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
    const index = findMemoryIndex(this.memoryList, address);
    const entry = this.memoryList[index - 1];
    let dv;
    if (entry?.address === address && entry.len === len) {
      dv = entry.targetDV;
    } else if (entry?.address <= address && address < adjustAddress(entry.address, entry.len)) {
      const offset = Number(address - entry.address);
      const isOpaque = size === undefined;
      const { targetDV } = entry;
      if (isOpaque) {
        len = targetDV.byteLength - offset;
      }
      dv = this.obtainView(targetDV.buffer, targetDV.byteOffset + offset, len);
      if (isOpaque) {
        // opaque structure--need to save the alignment
        dv[ALIGN] = entry.align;
      }
    }
    if (dv) {
      if (entry.shadowDV && context) {
        // add entry to context so memory get sync'ed
        if (!context.shadowList.includes(entry)) {
          context.shadowList.push(entry);
        }
      }
      return dv;
    }
    // not found in any of the buffers we've seen--assume it's Zig memory
    return this.obtainZigView(address, len);
  },
  findShadowView(dv) {
    for (const { shadowDV, targetDV } of this.memoryList) {
      if (targetDV === dv) {
        return shadowDV;
      }
    }
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
  ...({
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
    getTargetAddress(context, target, cluster, writable) {
      const dv = target[MEMORY];
      if (dv[ZIG]) {
        return this.getViewAddress(dv);
      } else if (dv.byteLength === 0) {
        // it's a null pointer/empty slice
        return 0;
      }
      // JS buffers always need shadowing
      return this.getShadowAddress(context, target, cluster, writable);
    },
    getBufferAddress(buffer) {
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
  } ),
});

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

const MemoryType = {
  Normal: 0,
  Scratch: 1,
};

export { MemoryType, memoryMapping as default };
