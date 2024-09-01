import { mixin } from "../environment";

export default mixin({
  variables: [],

  linkVariables(writeBack) {
    if (process.env.TARGET === 'wasm') {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (this.initPromise) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
      }
    }
    const pointers = [];
    for (const { object, reloc } of this.variables) {
      this.linkObject(object, reloc, writeBack);
      const getter = object[TARGET_GETTER];
      if (getter && object[SLOTS][0]) {
        pointers.push(object);
      }
    }
    // save locations of pointer targets
    for (const pointer of pointers) {
      const target = pointer[TARGET_GETTER]();
      const address = this.getViewAddress(target[MEMORY]);
      pointer[ADDRESS_SETTER](address);
      pointer[LENGTH_SETTER]?.(target.length);
    }
  },
  linkObject(object, reloc, writeBack) {
    if (object[MEMORY][FIXED]) {
      return;
    }
    const dv = object[MEMORY];
    const address = this.recreateAddress(reloc);
    const fixedDV = this.obtainFixedView(address, dv.byteLength);
    if (writeBack) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = fixedDV;
      dest[COPIER](object);
    }
    object[MEMORY] = fixedDV;
    const linkChildren = (object) => {
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          if (child) {
            const childDV = child[MEMORY];
            if (childDV.buffer === dv.buffer) {
              const offset = childDV.byteOffset - dv.byteOffset;
              child[MEMORY] = this.obtainView(fixedDV.buffer, offset, childDV.byteLength);
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
    if (!object[MEMORY][FIXED]) {
      return;
    }
    /* WASM-ONLY */
    object[MEMORY_RESTORER]?.();
    /* WASM-ONLY-END */
    const dv = object[MEMORY];
    const relocDV = this.allocateMemory(dv.byteLength);
    if (object[COPIER]) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = relocDV;
      dest[COPIER](object);
    }
    object[MEMORY] = relocDV;
  },
});
