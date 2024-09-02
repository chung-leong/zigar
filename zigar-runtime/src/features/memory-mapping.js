import { mixin } from '../environment.js';
import { ALIGN, FIXED, MEMORY, RESTORER } from '../symbols.js';
import { add, findSortedIndex, isInvalidAddress, isMisaligned } from '../utils.js';

export default mixin({
  emptyBuffer: new ArrayBuffer(0),

  getShadowAddress(target, cluster) {
    if (cluster) {
      const dv = target[MEMORY];
      if (cluster.address === undefined) {
        const shadow = this.createClusterShadow(cluster);
        cluster.address = this.getViewAddress(shadow[MEMORY]);
      }
      return add(cluster.address, dv.byteOffset - cluster.start);
    } else {
      const shadow = this.createShadow(target);
      return this.getViewAddress(shadow[MEMORY]);
    }
  },
  createShadow(object) {
    const dv = object[MEMORY]
    // use the alignment of the structure; in the case of an opaque pointer's target,
    // try to the alignment specified when the memory was allocated
    const align = object.constructor[ALIGN] ?? dv[ALIGN];
    const shadow = Object.create(object.constructor.prototype);
    shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    return this.addShadow(shadow, object, align);
  },
  addShadow(shadow, object, align) {
    const shadowMap = this.context.shadowMap ??= new Map();
    if (process.env.TARGET === 'wasm') {
      shadow[RESTORER] = this.getMemoryRestorer(null, this);
    }
    shadowMap.set(shadow, object);
    this.registerMemory(shadow[MEMORY], object[MEMORY], align);
    return shadow;
  },
  removeShadow(dv) {
    const { shadowMap } = this.context;
    if (shadowMap) {
      for (const [ shadow ] of shadowMap) {
        if (shadow[MEMORY] === dv) {
          shadowMap.delete(shadow);
          break;
        }
      }
    }
  },
  createClusterShadow(cluster) {
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
    const maxAlignAddress = getAlignedAddress(add(unalignedAddress, maxAlignOffset - start), maxAlign);
    const shadowAddress = add(maxAlignAddress, start - maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(add(shadowAddress, offset - start), align)) {
          throw new AlignmentConflict(align, maxAlign);
        }
      }
    }
    // placeholder object type
    const prototype = {
      [COPIER]: getMemoryCopier(len)
    };
    const source = Object.create(prototype);
    const shadow = Object.create(prototype);
    source[MEMORY] = new DataView(targets[0][MEMORY].buffer, Number(start), len);
    shadow[MEMORY] = shadowDV;
    /* WASM-ONLY */
    // attach fixed memory info to aligned data view so it gets freed correctly
    shadowDV[FIXED] = { address: shadowAddress, len, align: 1, unalignedAddress, type: MemoryType.Scratch };
    /* WASM-ONLY-END */
    return this.addShadow(shadow, source, 1);
  },
  updateShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      shadow[COPIER](object);
    }
  },
  updateShadowTargets() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      object[COPIER](shadow);
    }
  },
  releaseShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow ] of shadowMap) {
      this.freeShadowMemory(shadow[MEMORY]);
    }
  },
  registerMemory(dv, targetDV = null, targetAlign = undefined) {
    const { memoryList } = this.context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV, targetAlign });
    return address;
  },
  unregisterMemory(address) {
    const { memoryList } = this.context;
    const index = findMemoryIndex(memoryList, address);
    const entry = memoryList[index - 1];
    if (entry?.address === address) {
      memoryList.splice(index - 1, 1);
      return entry.dv;
    }
  },
  findMemory(address, count, size) {
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
    if (this.context) {
      const { memoryList } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const entry = memoryList[index - 1];
      if (entry?.address === address && entry.len === len) {
        return entry.targetDV ?? entry.dv;
      } else if (entry?.address <= address && address < add(entry.address, entry.len)) {
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
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len);
  },
  allocateFixedMemory(len, align, type = MemoryType.Normal) {
    const address = (len) ? this.allocateExternMemory(type, len, align) : 0;
    const dv = this.obtainFixedView(address, len);
    dv[FIXED].align = align;
    dv[FIXED].type = type;
    return dv;
  },
  freeFixedMemory(dv) {
    const { address, unalignedAddress, len, align, type } = dv[FIXED];
    if (len) {
      this.freeExternMemory(type, unalignedAddress ?? address, len, align);
    }
  },
  obtainFixedView(address, len) {
    let dv;
    if (address && len) {
      dv = this.obtainExternView(address, len);
    } else {
      // pointer to nothing
      let entry = this.viewMap.get(this.emptyBuffer);
      if (!entry) {
        this.viewMap.set(this.emptyBuffer, entry = {});
      }
      const key = `${address}:0`;
      dv = entry[key];
      if (!dv) {
        dv = entry[key] = new DataView(this.emptyBuffer);
        dv[FIXED] = { address, len: 0 };
      }
    }
    return dv;
  },
  releaseFixedView(dv) {
    // only allocated memory would have type attached
    if (dv[FIXED]?.type !== undefined) {
      this.freeFixedMemory(dv);
      dv[FIXED] = null;
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      allocateExternMemory: { argType: 'iii', returnType: 'i' },
      freeExternMemory: { argType: 'iiii' },
    },
    exports: {
      allocateHostMemory: { argType: 'ii', returnType: 'v' },
      freeHostMemory: { argType: 'iii' },
    },

    allocateHostMemory(len, align) {
      // allocate memory in both JavaScript and WASM space
      const constructor = { [ALIGN]: align };
      const copier = getMemoryCopier(len);
      const dv = this.allocateRelocMemory(len, align);
      const shadowDV = this.allocateShadowMemory(len, align);
      // create a shadow for the relocatable memory
      const object = { constructor, [MEMORY]: dv, [COPIER]: copier };
      const shadow = { constructor, [MEMORY]: shadowDV, [COPIER]: copier };
      this.addShadow(shadow, object, align);
      return shadowDV;
    },
    freeHostMemory(address, len, align) {
      const shadowDV = this.unregisterMemory(address);
      if (shadowDV) {
        this.removeShadow(shadowDV);
        this.freeShadowMemory(shadowDV);
      } else {
        throw new InvalidDeallocation(address);
      }
    },
    allocateShadowMemory(len, align) {
      return this.allocateFixedMemory(len, align, MemoryType.Scratch);
    },
    freeShadowMemory(dv) {
      return this.freeFixedMemory(dv);
    },
    obtainExternView(address, len) {
      const { buffer } = this.memory;
      if (!buffer[FIXED]) {
        buffer[FIXED] = { address: 0, len: buffer.byteLength };
      }
      return this.obtainView(buffer, address, len);
    },
    getTargetAddress(target, cluster) {
      const dv = target[MEMORY];
      if (dv[FIXED]) {
        return this.getViewAddress(dv);
      } else if (dv.byteLength === 0) {
        // it's a null pointer/empty slice
        return 0;
      }
      // relocatable buffers always need shadowing
    },
    getMemoryOffset(address) {
      // WASM address space starts at 0
      return address;
    },
    recreateAddress(reloc) {
      return reloc;
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      allocateExternMemory: null,
      freeExternMemory: null,
    },
    exports: {
      allocateHostMemory: null,
      freeHostMemory: null,
    },

    allocateHostMemory(len, align) {
      const dv = this.allocateRelocMemory(len, align);
      this.registerMemory(dv);
      return dv;
    },
    freeHostMemory(address, len, align) {
      // no freeing actually occurs--memory will await garbage collection
      const dv = this.unregisterMemory(address);
      if (!dv) {
        throw new InvalidDeallocation(address);
      }
    },
    allocateShadowMemory(len, align) {
      // Node can read into JavaScript memory space so we can keep shadows there
      return this.allocateRelocMemory(len, align);
    },
    freeShadowMemory(dv) {
      // nothing needs to happen
    },
    obtainExternView(address, len) {
      const buffer = this.obtainExternBuffer(address, len);
      buffer[FIXED] = { address, len };
      return this.obtainView(buffer, 0, len);
    },
    getTargetAddress(target, cluster) {
      const dv = target[MEMORY];
      if (cluster) {
        // pointer is pointing to buffer with overlapping views
        if (cluster.misaligned === undefined) {
          const address = this.getBufferAddress(dv.buffer);
          // ensure that all pointers are properly aligned
          for (const target of cluster.targets) {
            const offset = target[MEMORY].byteOffset;
            const align = target.constructor[ALIGN];
            const viewAddress = add(address, offset);
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
          return add(cluster.address, dv.byteOffset);
        }
      } else {
        const align = target.constructor[ALIGN];
        const address = this.getViewAddress(dv);
        if (!isMisaligned(address, align)) {
          this.registerMemory(dv);
          return address;
        }
      }
      // need shadowing
    },
    getBufferAddress(buffer) {
      if (process.env.DEV) {
        if (buffer !== this.memory.buffer) {
          throw new Error('Cannot obtain address of relocatable buffer');
        }
      }
      return 0;
    },
  } : undefined),
});

export function isNeeded() {
  // TODO
}

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

export const MemoryType = {
  Normal: 0,
  Scratch: 1,
};
