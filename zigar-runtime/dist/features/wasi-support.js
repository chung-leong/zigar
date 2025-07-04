import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var wasiSupport = mixin({
  init() {
    this.customWASI = null;
  },
  setCustomWASI(wasi) {
    if (wasi && this.executable) {
      throw new Error('Cannot set WASI interface after compilation has already begun');
    }
    this.customWASI = wasi;
  },
  getWASIHandler(name) {
    const nameCamelized = name.replace(/_./g, m => m.charAt(1).toUpperCase());
    return this.customWASI?.wasiImport?.[name] 
        ?? this[nameCamelized]?.bind?.(this)
        ?? (() => {
          console.error(`Not implemented: ${name}`);
          return PosixError.ENOTSUP;
        });
  },
}) ;

export { wasiSupport as default };
