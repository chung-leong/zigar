import { mixin } from '../environment.js';
import { SIZE, ALIGN, MEMORY } from '../symbols.js';
import { usizeMax } from '../utils.js';

var defaultAllocator = mixin({
  allocatorVTable: null,

  createDefaultAllocator(args, structure) {
    const { constructor: Allocator } = structure;
    let vtable = this.allocatorVTable;
    if (!vtable) {
      // create vtable in Zig memory
      const { VTable, noResize } = Allocator;
      const dv = this.allocateZigMemory(VTable[SIZE], VTable[ALIGN]);
      vtable = this.allocatorVTable = VTable(dv);
      vtable.alloc = (ptr, len, ptrAlign) => this.allocateHostMemory(len, 1 << ptrAlign);
      vtable.free = (ptr, buf, ptrAlign) => {
        const address = this.getViewAddress(buf['*'][MEMORY]);
        const len = buf.length;
        this.freeHostMemory(address, len, 1 << ptrAlign);
      };
      vtable.resize = noResize;
    }
    const ptr = this.obtainZigView(usizeMax, 0);
    return new Allocator({ ptr, vtable });
  },
  freeDefaultAllocator() {
    if (this.allocatorVTable) {
      const dv = this.allocatorVTable[MEMORY];
      this.allocatorVTable = null;
      this.freeZigMemory(dv);
    }
  },
  allocateHostMemory(len, align) {
    const targetDV = this.allocateJSMemory(len, align);
    {
      const shadowDV = this.allocateShadowMemory(len, align);
      const address = this.getViewAddress(shadowDV);
      this.registerMemory(address, len, align, true, targetDV, shadowDV);
      return shadowDV;
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
