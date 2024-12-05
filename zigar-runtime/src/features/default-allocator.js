import { mixin } from '../environment.js';
import { MEMORY, ZIG } from '../symbols.js';
import { usizeInvalid } from '../utils.js';

export default mixin({
  defaultAllocator: null,
  vtableFnIds: null,

  createDefaultAllocator(args, structure) {
    let allocator = this.defaultAllocator;
    if (!allocator) {
      const { constructor: Allocator } = structure;
      const { VTable, noResize } = Allocator;
      const vtable = {
        alloc: (ptr, len, ptrAlign) => this.allocateHostMemory(len, 1 << ptrAlign),
        free: (ptr, buf, ptrAlign) => {
          const address = this.getViewAddress(buf['*'][MEMORY]);
          const len = buf.length;
          this.freeHostMemory(address, len, 1 << ptrAlign);
        },
        resize: noResize,
      };
      const ptr = this.obtainZigView(usizeInvalid, 0);
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
      targetDV[ZIG] = { address, len, js: true };
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