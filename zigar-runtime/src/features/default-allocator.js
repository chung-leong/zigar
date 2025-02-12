import { mixin } from '../environment.js';
import { MEMORY, ZIG } from '../symbols.js';
import { usizeMax } from '../utils.js';

export default mixin({
  init() {
    this.defaultAllocator = null;
    this.vtableFnIds = null;
    if (process.env.DEV) {
      this.allocationCount = 0;
      this.allocationBytes = 0;
      this.freedBytes = 0;
    }
  },
  createDefaultAllocator(args, structure) {
    let allocator = this.defaultAllocator;
    if (!allocator) {
      const { constructor: Allocator } = structure;
      const { noResize, noRemap } = Allocator;
      const vtable = {
        alloc: (ptr, len, ptrAlign) => this.allocateHostMemory(len, 1 << ptrAlign),
        free: (ptr, buf, ptrAlign) => {
          const address = this.getViewAddress(buf['*'][MEMORY]);
          const len = buf.length;
          this.freeHostMemory(address, len, 1 << ptrAlign);
        },
        resize: noResize,
      };
      if (noRemap) {
        vtable.remap = noRemap;
      }
      const ptr = this.obtainZigView(usizeMax, 0);
      allocator = this.defaultAllocator = new Allocator({ ptr, vtable });
      this.vtableFnIds = [ vtable.alloc, vtable.free ].map((fn) => this.getFunctionId(fn));
    }
    return allocator;
  },
  freeDefaultAllocator() {
    if (this.vtableFnIds) {
      for (const id of this.vtableFnIds) {
        this.releaseFunction(id);
      }
      this.defaultAllocator = null;
      this.vtableFnIds = null;
    }
  },
  allocateHostMemory(len, align) {
    if (process.env.DEV) {
      this.allocationCount++;
      this.allocationBytes += len;
    }
    const targetDV = this.allocateJSMemory(len, align);
    if (process.env.TARGET === 'wasm') {
      try {
        const shadowDV = this.allocateShadowMemory(len, align);
        const address = this.getViewAddress(shadowDV);
        this.registerMemory(address, len, align, true, targetDV, shadowDV);
        return shadowDV;
      } catch (err) {
        return null;
      }
    } else {
      const address = this.getViewAddress(targetDV);
      this.registerMemory(address, len, align, true, targetDV);
      // pretend that the view holds Zig memory to get around code that prevents pointers
      // in Zig memory to point at JS memory
      targetDV[ZIG] = { address, len, js: true };
      return targetDV;
    }
  },
  freeHostMemory(address, len, align) {
    if (process.env.DEV) {
      this.freedBytes += len;
    }
    const entry = this.unregisterMemory(address, len);
    if (process.env.TARGET === 'wasm') {
      if (entry) {
        this.freeShadowMemory(entry.shadowDV);
      }
    }
  },
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagDefaultAllocator() {
      this.showDiagnostics('Default allocator', [
        `Present: ${!!this.defaultAllocator}`,
        `Vtable fn ids: ${this.vtableFnIds?.join(', ')}`,
        `Allcoation count ${this.allocationCount}`,
        `Allocated bytes ${this.allocationBytes}`,
        `Freed bytes ${this.freedBytes}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});