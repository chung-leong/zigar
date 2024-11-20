import { mixin } from '../environment.js';
import { ALIGN, MEMORY, SIZE, ZIG } from '../symbols.js';
import { usizeMax } from '../utils.js';

export default mixin({
  allocatorVTable: null,

  createDefaultAllocator(args, structure) {
    const { constructor: Allocator } = structure;
    let vtable = this.allocatorVTable;
    if (!vtable) {
      // create vtable in Zig memory
      const { VTable, noResize } = Allocator;
      const dv = this.allocateZigMemory(VTable[SIZE], VTable[ALIGN]);
      vtable = this.allocatorVTable = VTable(dv);
      vtable.alloc = (ptr, len, ptrAlign) => {
        return this.allocateHostMemory(len, 1 << ptrAlign);
      };
      vtable.resize = noResize;
      vtable.free = (ptr, buf, ptrAlign) => {
        const address = this.getViewAddress(buf['*'][MEMORY]);
        const len = buf.length;
        this.freeHostMemory(address, len, 1 << ptrAlign);
      };
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
    if (process.env.TARGET === 'wasm') {
      const shadowDV = this.allocateShadowMemory(len, align);
      const address = this.getViewAddress(shadowDV);
      this.registerMemory(address, len, align, true, targetDV, shadowDV);
      return shadowDV;
    } else {
      const address = this.getViewAddress(targetDV);
      this.registerMemory(address, len, align, true, targetDV);
      // pretend that the view holds Zig memory to get around code that prevents pointers
      // in Zig memory to point at JS memory
      targetDV[ZIG] = { address, len };
      return targetDV;
    }
  },
  freeHostMemory(address, len, align) {
    const entry = this.unregisterMemory(address, len);
    if (process.env.TARGET === 'wasm') {
      if (entry) {
        this.freeShadowMemory(entry.shadowDV);
      }
    }
  },
});