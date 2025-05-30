import { mixin } from '../environment.js';
import { MEMORY } from '../symbols.js';
import { usizeMax } from '../utils.js';

var defaultAllocator = mixin({
  init() {
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
      this.destructors.push(() => this.freeFunction(vtable.alloc));
      this.destructors.push(() => this.freeFunction(vtable.free));
    }
    return allocator;
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
