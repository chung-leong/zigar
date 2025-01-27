import { mixin } from '../environment.js';
import { MEMORY } from '../symbols.js';
import { usizeMax } from '../utils.js';

var defaultAllocator = mixin({
  init() {
    this.defaultAllocator = null;
    this.vtableFnIds = null;
  },
  createDefaultAllocator(args, structure) {
    let allocator = this.defaultAllocator;
    if (!allocator) {
      const { constructor: Allocator } = structure;
      const { noResize } = Allocator;
      const vtable = {
        alloc: (ptr, len, ptrAlign) => this.allocateHostMemory(len, 1 << ptrAlign),
        free: (ptr, buf, ptrAlign) => {
          const address = this.getViewAddress(buf['*'][MEMORY]);
          const len = buf.length;
          this.freeHostMemory(address, len, 1 << ptrAlign);
        },
        resize: noResize,
      };
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
    const targetDV = this.allocateJSMemory(len, align);
    {
      try {
        const shadowDV = this.allocateShadowMemory(len, align);
        const address = this.getViewAddress(shadowDV);
        this.registerMemory(address, len, align, true, targetDV, shadowDV);
        return shadowDV;
      } catch (err) {
        return null;
      }
    }
  },
  freeHostMemory(address, len, align) {
    const entry = this.unregisterMemory(address, len);
    {
      if (entry) {
        this.freeShadowMemory(entry.shadowDV);
      }
    }
  },
});

export { defaultAllocator as default };
