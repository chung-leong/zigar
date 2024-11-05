import { mixin } from '../environment.js';
import {
  ADDRESS, COPY, LENGTH, MEMORY, RESTORE, SLOTS, TARGET, ZIG,
} from '../symbols.js';

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
    for (const { object, reloc } of this.variables) {
      this.linkObject(object, reloc, writeBack);
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
  linkObject(object, reloc, writeBack) {
    if (object[MEMORY][ZIG]) {
      return;
    }
    const dv = object[MEMORY];
    const address = this.recreateAddress(reloc);
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
    if (!object[MEMORY][ZIG]) {
      return;
    }
    if (process.env.TARGET === 'wasm') {
      object[RESTORE]?.();
    }
    const dv = object[MEMORY];
    const relocDV = this.allocateMemory(dv.byteLength);
    if (object[COPY]) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = relocDV;
      dest[COPY](object);
    }
    object[MEMORY] = relocDV;
  },
  ...(process.env.TARGET === 'wasm' ? {
    recreateAddress(reloc) {
      return reloc;
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
