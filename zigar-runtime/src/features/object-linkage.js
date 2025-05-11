import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { CACHE, MEMORY, SLOTS, UPDATE, VISIT, ZIG } from '../symbols.js';

export default mixin({
  linkVariables(writeBack) {
    if (process.env.TARGET === 'wasm') {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (!this.memory) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
        return;
      }
    }
    const copy = this.getCopyFunction();
    for (const { object, handle } of this.variables) {
      const jsDV = object[MEMORY];
      // objects in WebAssembly have fixed addresses so the handle is the address
      // for native code module, locations of objects in memory can change depending on
      // where the shared library is loaded
      const address = (process.env.TARGET === 'wasm') ? handle : this.recreateAddress(handle);
      let zigDV = object[MEMORY] = this.obtainZigView(address, jsDV.byteLength);
      if (writeBack) {
        copy(zigDV, jsDV);
      }
      object.constructor[CACHE]?.save?.(zigDV, object);
      this.destructors.push(() => {
        if (process.env.TARGET === 'wasm') {
          zigDV = this.restoreView(object[MEMORY]);
        }
        object[MEMORY] = jsDV;
        copy(jsDV, zigDV);
      });
      const linkChildren = (object) => {
        const slots = object[SLOTS];
        if (slots) {
          const parentOffset = zigDV.byteOffset;
          for (const child of Object.values(slots)) {
            if (child) {
              const childDV = child[MEMORY];
              if (childDV.buffer === jsDV.buffer) {
                const offset = parentOffset + childDV.byteOffset - jsDV.byteOffset;
                child[MEMORY] = this.obtainView(zigDV.buffer, offset, childDV.byteLength);
                child.constructor[CACHE]?.save?.(zigDV, child);
                linkChildren(child);
              }
            }
          }
        }
      };
      linkChildren(object);
      // update pointer targets
      object[VISIT]?.(function() { this[UPDATE]() }, VisitorFlag.IgnoreInactive);
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      recreateAddress: null,
    },
    /* c8 ignore next */
  } : undefined),
  });
