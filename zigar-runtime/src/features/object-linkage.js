import { mixin } from '../environment.js';
import { ADDRESS, COPY, LENGTH, MEMORY, SLOTS, TARGET, ZIG } from '../symbols.js';

export default mixin({
  linkVariables(writeBack) {
    if (process.env.TARGET === 'wasm') {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (!this.memory) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
        return;
      }
    }
    const pointers = [];
    for (const { object, handle } of this.variables) {
      this.linkObject(object, handle, writeBack);
      if (TARGET in object && object[SLOTS][0]) {
        pointers.push(object);
      }
    }
    // save locations of pointer targets
    for (const pointer of pointers) {
      const target = pointer[TARGET];
      const address = this.getViewAddress(target[MEMORY]);
      pointer[ADDRESS] = address;
      if (LENGTH in pointer) {
        pointer[LENGTH] = target.length;
      }
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
    const address = (process.env.TARGET === 'wasm') ? handle : this.recreateAddress(handle);
    const length = dv.byteLength;
    const zigDV = this.obtainZigView(address, length);
    if (writeBack && length > 0) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = zigDV;
      dest[COPY](object);
    }
    object[MEMORY] = zigDV;
    const linkChildren = (object) => {
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          if (child) {
            const childDV = child[MEMORY];
            if (childDV.buffer === dv.buffer) {
              const offset = childDV.byteOffset - dv.byteOffset;
              child[MEMORY] = this.obtainView(zigDV.buffer, offset, childDV.byteLength);
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
    const { zig } = object[MEMORY][ZIG];
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
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      recreateAddress: null,
    },
    /* c8 ignore start */
  } : undefined),
    ...(process.env.MIXIN === 'track' ? {
    useObjectLinkage() {
      // empty function used for mixin tracking
    },
  } : undefined),
    /* c8 ignore end */
  });
