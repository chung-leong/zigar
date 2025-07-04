import { mixin } from '../environment.js';
import { MEMORY, RESET, ZIG } from '../symbols.js';
import { defineProperty, usize, usizeMax } from '../utils.js';

export default mixin({
  init() {
    this.defaultAllocator = null;
    this.allocatorVtable =  null;
    this.allocatorContextMap = new Map();
    this.nextAllocatorContextId = usize(0x1000);
    if (process.env.DEV) {
      this.allocationCount = 0;
      this.allocationBytes = 0;
      this.freedBytes = 0;
    }
  },
  createDefaultAllocator(args, structure) {
    let allocator = this.defaultAllocator;
    if (!allocator) {
      allocator = this.defaultAllocator = this.createJsAllocator(args, structure, false);
    }
    return allocator;
  },
  createJsAllocator(args, structure, resettable) {
    const { constructor: Allocator } = structure;
    let vtable = this.allocatorVtable;
    if (!vtable) {      
      const { noResize, noRemap } = Allocator;
      vtable = this.allocatorVtable = {
        alloc: this.allocateHostMemory.bind(this),
        free: this.freeHostMemory.bind(this),
        resize: noResize,
      };
      if (noRemap) {
        vtable.remap = noRemap;
      }
      this.destructors.push(() => this.freeFunction(vtable.alloc));
      this.destructors.push(() => this.freeFunction(vtable.free));
    }
    let contextId = usizeMax;
    if (resettable) {
      // create list used to clean memory allocated for generator
      const list = [];
      contextId = this.nextAllocatorContextId++;
      this.allocatorContextMap.set(contextId, list);
      args[RESET] = (done) => {
        for (const { address, len } of list) {
          const entry = this.unregisterMemory(address, len);
          if (process.env.TARGET === 'wasm') {
            if (entry) {
              this.freeShadowMemory(entry.shadowDV);
            }
          }
          if (done) {
            this.allocatorContextMap.delete(contextId);
          }
        }
        list.splice(0);
      };
    }
    const ptr = this.obtainZigView(contextId, 0);
    return new Allocator({ ptr, vtable });
  },
  allocateHostMemory(ptr, len, ptrAlign) {
    if (process.env.DEV) {
      this.allocationCount++;
      this.allocationBytes += len;
    }
    // see if we're dealing with a resettable allocator
    const contextId = this.getViewAddress(ptr['*'][MEMORY]);
    const list = (contextId != usizeMax) ? this.allocatorContextMap.get(contextId) : null;
    const align = 1 << ptrAlign;
    const targetDV = this.allocateJSMemory(len, align);
    if (process.env.TARGET === 'wasm') {
      try {
        const shadowDV = this.allocateShadowMemory(len, align);
        const address = this.getViewAddress(shadowDV);
        this.registerMemory(address, len, align, true, targetDV, shadowDV);
        // save address and len if resettable
        list?.push({ address, len });
        return shadowDV;
      } catch (err) {
        return null;
      }
    } else {
      const address = this.getViewAddress(targetDV);
      this.registerMemory(address, len, align, true, targetDV);
      // pretend that the view holds Zig memory to get around code that prevents pointers
      // in Zig memory to point at JS memory
      defineProperty(targetDV, ZIG, { value: { address, len, js: true }, enumerable: false });
      list?.push({ address, len });
      return targetDV;
    }
  },
  freeHostMemory(ptr, buf, ptrAlign) {
    const dv = buf['*'][MEMORY];
    const address = this.getViewAddress(dv);
    const len = dv.byteLength;
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
    diagJsAllocator() {
      this.showDiagnostics('JavaScript allocator', [
        `Default present: ${!!this.defaultAllocator}`,
        `Allcoation count ${this.allocationCount}`,
        `Allocated bytes ${this.allocationBytes}`,
        `Freed bytes ${this.freedBytes}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});