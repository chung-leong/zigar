import { mixin } from '../environment.js';
import { AlignmentConflict } from '../errors.js';
import { ALIGN, FALLBACK, MEMORY, ZIG } from '../symbols.js';
import {
  adjustAddress, alignForward, findSortedIndex, isInvalidAddress, isMisaligned, usizeInvalid,
  usizeMax,
  usizeMin
} from '../utils.js';

export default mixin({
  init() {
    this.isMemoryMapping = true;
    this.memoryList = [];
    this.contextCount = 0;
    if (process.env.TARGET === 'node') {
      this.externBufferList = [];
    }
    if (process.env.DEV) {
      this.shadowMemoryBytes = 0;
    }
  },
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
        if (process.env.TARGET === 'wasm') {
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
      const address = this.getViewAddress(shadowDV)
      const entry = this.registerMemory(address, len, 1, writable, targetDV, shadowDV);
      context.shadowList.push(entry);
      return address;
    }
  },
  updateShadows(context) {
    const copy = this.getCopyFunction();
    for (let { targetDV, shadowDV } of context.shadowList) {
      if (process.env.TARGET === 'wasm') {
        shadowDV = this.restoreView(shadowDV);
      }
      copy(shadowDV, targetDV);
    }
  },
  updateShadowTargets(context) {
    const copy = this.getCopyFunction();
    for (let { targetDV, shadowDV, writable } of context.shadowList) {
      if (writable) {
        if (process.env.TARGET === 'wasm') {
          shadowDV = this.restoreView(shadowDV);
        }
        copy(targetDV, shadowDV);
      }
    }
  },
  registerMemory(address, len, align, writable, targetDV, shadowDV) {
    const index = findMemoryIndex(this.memoryList, address, len);
    let entry = this.memoryList[index - 1];
    if (entry?.address === address && entry.len === len) {
      entry.writable ||= writable;
    } else {
      entry = { address, len, align, writable, targetDV, shadowDV }
      this.memoryList.splice(index, 0, entry);
    }
    return entry;
  },
  unregisterMemory(address, len) {
    const index = findMemoryIndex(this.memoryList, address, len);
    const entry = this.memoryList[index - 1];
    if (entry?.address === address && entry.len === len) {
      this.memoryList.splice(index - 1, 1);
      return entry;
    }
  },
  findMemory(context, address, count, size) {
    let len = count * (size ?? 0);
    const index = findMemoryIndex(this.memoryList, address, len);
    const entry = this.memoryList[index - 1];
    let dv;
    if (entry?.address === address && entry.len === len) {
      dv = entry.targetDV;
    } else if (entry?.address <= address && adjustAddress(address, len) <= adjustAddress(entry.address, entry.len)) {
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
    if (!dv) {
      // not found in any of the buffers we've seen--assume it's Zig memory
      dv = this.obtainZigView(address, len);
    } else {
      let { targetDV, shadowDV } = entry;
      if (shadowDV && context && !context.shadowList.includes(entry)) {
        if (process.env.TARGET === 'wasm') {
          shadowDV = this.restoreView(shadowDV);
        }
        const copy = this.getCopyFunction();
        copy(targetDV, shadowDV);
      }
    }
    return dv;
  },
  findShadowView(dv) {
    for (const { shadowDV, targetDV } of this.memoryList) {
      if (targetDV === dv) {
        return shadowDV;
      }
    }
  },
  releaseZigView(dv) {
    const zig = dv[ZIG];
    const address = zig?.address;
    if (address && address !== usizeInvalid) {
      // set address to invalid to avoid double free
      zig.address = usizeInvalid;
      if (process.env.TARGET === 'node') {
        this.unregisterBuffer(adjustAddress(address, -dv.byteOffset));
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
      allocateScratchMemory: { argType: 'ii', returnType: 'i' },
      freeScratchMemory: { argType: 'iii' },
    },
    exports: {
      getViewAddress: { argType: 'v', returnType: 'i' },
    },
    usizeMaxBuffer: new ArrayBuffer(0),

    allocateShadowMemory(len, align) {
      const address = (len) ? this.allocateScratchMemory(len, align) : 0;
      if (!address && len) {
        throw new Error('Out of memory');
      }
      const dv = this.obtainZigView(address, len);
      const zig = dv?.[ZIG];
      if (zig) {
        zig.align = align;
        if (process.env.DEV) {
          this.shadowMemoryBytes += len;
        }
      }
      return dv;
    },
    freeShadowMemory(dv) {
      const { address, unalignedAddress, len, align } = dv[ZIG];
      if (len) {
        this.freeScratchMemory(unalignedAddress ?? address, len, align);
      }
      this.releaseZigView(dv);
      if (process.env.DEV) {
        this.shadowMemoryBytes -= dv.byteLength;
      }
    },
    obtainZigView(address, len, cache = true) {
      if (isInvalidAddress(address)) {
        address = (len > 0) ? 0 : usizeMax;
      }
      if (!address && len) {
        return null;
      }
      let { buffer } = this.memory;
      if (address === usizeMax) {
        buffer = this.usizeMaxBuffer;
        address = usizeMin;
        len = 0;
      }
      return (cache) ? this.obtainView(buffer, 0, 0) : new DataView(buffer, address, len);
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
      if (process.env.DEV) {
        if (buffer !== this.memory.buffer) {
          throw new Error('Cannot obtain address of JavaScript buffer');
        }
      }
      return 0;
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      getBufferAddress: null,
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
    obtainZigView(address, len, cache = true) {
      if (isInvalidAddress(address)) {
        address = (len > 0) ? 0 : usizeMax;
      }
      if (!address && len) {
        return null;
      }
      if (cache) {
        const index = findMemoryIndex(this.externBufferList, address);
        const entry = this.externBufferList[index - 1];
        let buffer, offset;
        if (entry?.address <= address && adjustAddress(address, len) <= adjustAddress(entry.address, entry.len)) {
          buffer = entry.buffer;
          offset = Number(address - entry.address);
        } else {
          // cannot obtain zero-length buffer
          buffer = (len > 0) ? this.obtainExternBuffer(address, len, FALLBACK) : new ArrayBuffer(0);
          buffer[ZIG] = { address, len };
          this.externBufferList.splice(index, 0, { address, len, buffer })
          offset = 0;
        }
        return this.obtainView(buffer, offset, len);  
      } else {
        const buffer = this.obtainExternBuffer(address, len, FALLBACK);
        return new DataView(buffer, 0, len);
      }
    },
    unregisterBuffer(address) {
      const index = findMemoryIndex(this.externBufferList, address);
      const entry = this.externBufferList[index - 1];
      if (entry?.address === address) {
        this.externBufferList.splice(index - 1, 1);
      }
    },
    getTargetAddress(context, target, cluster, writable) {
      const targetDV = target[MEMORY];
      if (cluster) {
        // pointer is pointing to buffer with overlapping views
        if (cluster.misaligned === undefined) {
          const address = this.getBufferAddress(targetDV.buffer);
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
          return adjustAddress(cluster.address, targetDV.byteOffset);
        }
      } else {
        const align = target.constructor[ALIGN];
        const address = this.getViewAddress(targetDV);
        if (!isMisaligned(address, align)) {
          const len = targetDV.byteLength;
          this.registerMemory(address, len, align, writable, targetDV);
          return address;
        }
      }
      // need shadowing
      return this.getShadowAddress(context, target, cluster, writable);
    },
    /* c8 ignore next */
  } : undefined),
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagMemoryMapping() {
      const targetSpecific = (process.env.TARGET === 'node') ? [
        `Extern buffer count: ${this.externBufferList.length}`,
      ] : [];
      this.showDiagnostics('Memory mapping', [
        `Memory list length: ${this.memoryList.length}`,
        `Context count: ${this.contextCount}`,
        `Shadow memory: ${this.shadowMemoryBytes}`,
        ...targetSpecific,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

export const MemoryType = {
  Normal: 0,
  Scratch: 1,
};
