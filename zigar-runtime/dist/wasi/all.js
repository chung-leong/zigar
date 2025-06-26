import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var all = mixin({
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
    return this.customWASI?.wasiImport?.[name] 
        ?? this[`wasi_${name}`]?.bind?.(this)
        ?? (() => {
          console.error(`Not implemented: ${name}`);
          return PosixError.EOPNOTSUPP;
        });
  },
});

export { all as default };
