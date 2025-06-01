import { mixin } from '../environment.js';
import { MEMORY, RESET } from '../symbols.js';
import { usizeMax, usize } from '../utils.js';

var jsAllocator = mixin({
  init() {
    this.defaultAllocator = null;
    this.allocatorVtable =  null;
    this.allocatorContextMap = new Map();
    this.nextAllocatorContextId = usize(0x1000);
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
          {
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
    // see if we're dealing with a resettable allocator
    const contextId = this.getViewAddress(ptr['*'][MEMORY]);
    const list = (contextId != usizeMax) ? this.allocatorContextMap.get(contextId) : null;
    const align = 1 << ptrAlign;
    const targetDV = this.allocateJSMemory(len, align);
    {
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
    }
  },
  freeHostMemory(ptr, buf, ptrAlign) {
    const dv = buf['*'][MEMORY];
    const address = this.getViewAddress(dv);
    const len = dv.byteLength;
    const entry = this.unregisterMemory(address, len);
    {
      if (entry) {
        this.freeShadowMemory(entry.shadowDV);
      }
    }
  },
});

export { jsAllocator as default };
