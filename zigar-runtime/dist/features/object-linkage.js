import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, CACHE, VISIT, UPDATE, ZIG, SLOTS } from '../symbols.js';

var objectLinkage = mixin({
  linkVariables(writeBack) {
    {
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
      const address = handle ;
      const zigDV = object[MEMORY] = this.obtainZigView(address, jsDV.byteLength);
      if (writeBack) {
        copy(zigDV, jsDV);
      }
      object.constructor[CACHE]?.save?.(zigDV, object);
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
  },
  unlinkVariables() {
    const copy = this.getCopyFunction();
    for (const { object } of this.variables) {
      const zigDV = this.restoreView(object[MEMORY]) ;
      const zig = zigDV[ZIG];
      if (zig) {
        const jsDV = object[MEMORY] = this.allocateMemory(zig.len);
        copy(jsDV, zigDV);
      }
    }
  },
  ...({
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } ),
  });

export { objectLinkage as default };
