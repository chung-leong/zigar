import { mixin } from '../environment.js';
import { ALIGN, CONTEXT, COPY, MEMORY, SIZE } from '../symbols.js';
import { empty, usizeMax } from '../utils.js';

export default mixin({
  nextContextId: usizeMax,
  contextMap: new Map(),
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
        const contextId = this.getViewAddress(ptr['*'][MEMORY]);
        const context = this.contextMap.get(contextId);
        if (context) {
          return this.allocateHostMemory(context, len, 1 << ptrAlign);
        } else {
          return null;
        }
      };
      vtable.resize = noResize;
      vtable.free = (ptr, buf, ptrAlign) => {
        const contextId = this.getViewAddress(ptr['*'][MEMORY]);
        const context = this.contextMap.get(contextId);
        if (context) {
          const address = this.getViewAddress(buf['*'][MEMORY]);
          const len = buf.length;
          this.freeHostMemory(context, address, len, 1 << ptrAlign);
        }
      };
    }
    const context = args[CONTEXT];
    const contextId = context.id = this.nextContextId--;
    // storing context id in a fake pointer
    const ptr = this.obtainZigView(contextId, 0);
    this.contextMap.set(contextId, context);
    return new Allocator({ ptr, vtable });
  },
  allocateHostMemory(context, len, align) {
    const dv = this.allocateJSMemory(len, align);
    // for WebAssembly, we need to allocate Zig memory that backs the JS memory
    // for Node, we create another DataView on the same buffer and pretend that it's zig
    // memory
    const shadowDV = (process.env.TARGET === 'wasm')
    ? this.allocateShadowMemory(len, align)
    : this.createShadowView(dv);
    const copier = (process.env.TARGET === 'wasm')
    ? this.defineCopier(len).value
    : empty;
    const constructor = { [ALIGN]: align };
    const object = { constructor, [MEMORY]: dv, [COPY]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [COPY]: copier };
    this.addShadow(context, shadow, object, align);
    return shadowDV;
  },
  freeHostMemory(context, address, len, align) {
    const shadowDV = this.unregisterMemory(context, address);
    if (shadowDV) {
      this.removeShadow(context, shadowDV);
      this.freeShadowMemory(shadowDV);
    }
  },
  releaseCallContext(context) {
    if (!context.retained) {
      this.contextMap.delete(context.id);
    }
  },
  freeDefaultAllocator() {
    if (this.allocatorVTable) {
      const dv = this.allocatorVTable[MEMORY];
      this.allocatorVTable = null;
      this.freeZigMemory(dv);
    }
  },
});