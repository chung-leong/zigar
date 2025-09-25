import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, CACHE, VISIT, UPDATE, SLOTS } from '../symbols.js';
import { copyView } from '../utils.js';

var objectLinkage = mixin({
  linkVariables(writeBack) {
    {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (!this.memory) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
        return;
      }
    }
    for (const { object, handle } of this.variables) {
      const jsDV = object[MEMORY];
      // objects in WebAssembly have fixed addresses so the handle is the address
      // for native code module, locations of objects in memory can change depending on
      // where the shared library is loaded
      const address = handle ;
      let zigDV = object[MEMORY] = this.obtainZigView(address, jsDV.byteLength);
      if (writeBack) {
        copyView(zigDV, jsDV);
      }
      object.constructor[CACHE]?.save?.(zigDV, object);
      this.destructors.push(() => {
        {
          debugger;
          zigDV = this.restoreView(object[MEMORY]);
        }
        const jsDV = object[MEMORY] = this.allocateMemory(zigDV.byteLength);
        copyView(jsDV, zigDV);
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
      object[VISIT]?.(function() { this[UPDATE](); }, VisitorFlag.IgnoreInactive);
    }
    // create thunks of function objects that were created prior to compilation
    this.createDeferredThunks?.();
  },
  ...({
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } ),
  });

export { objectLinkage as default };
