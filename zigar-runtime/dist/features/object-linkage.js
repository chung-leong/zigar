import { mixin } from '../environment.js';
import { TARGET, SLOTS, MEMORY, ZIG, COPY, CACHE } from '../symbols.js';

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
      this.linkObject(object, handle, writeBack);
      if (TARGET in object && object[SLOTS][0]) ;
    }
  },
  linkObject(object, handle, writeBack) {
    if (object[MEMORY][ZIG]) {
      return;
    }
    const dv = object[MEMORY];
    // objects in WebAssembly have fixed addresses so the handle is the address
    // for native code module, locations of objects in memory can change depending on
    // where the shared library is loaded
    const address = handle ;
    const length = dv.byteLength;
    const zigDV = this.obtainZigView(address, length);
    if (writeBack && length > 0) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = zigDV;
      dest[COPY](object);
    }
    object[MEMORY] = zigDV;
    object.constructor[CACHE]?.save?.(zigDV, object);
    const linkChildren = (object) => {
      const slots = object[SLOTS];
      if (slots) {
        const parentOffset = zigDV.byteOffset;
        for (const child of Object.values(slots)) {
          if (child) {
            const childDV = child[MEMORY];
            if (childDV.buffer === dv.buffer) {
              const offset = parentOffset + childDV.byteOffset - dv.byteOffset;
              child[MEMORY] = this.obtainView(zigDV.buffer, offset, childDV.byteLength);
              child.constructor[CACHE]?.save?.(zigDV, child);
              linkChildren(child);
            }
          }
        }
      }
    };
    linkChildren(object);
  },
  unlinkVariables() {
    for (const { object } of this.variables) {
      this.unlinkObject(object);
    }
  },
  unlinkObject(object) {
    const zig = object[MEMORY]?.[ZIG];
    if (!zig) {
      return;
    }
    const { len } = zig;
    const jsDV = this.allocateMemory(len);
    if (object[COPY]) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = jsDV;
      dest[COPY](object);
    }
    object[MEMORY] = jsDV;
  },
  ...({
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } ),
    ...(undefined),
    /* c8 ignore end */
  });

export { objectLinkage as default };
