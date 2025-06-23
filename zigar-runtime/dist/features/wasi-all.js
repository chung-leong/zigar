import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var wasiAll = mixin({
  init() {
    this.customWASI = null;
    this.wasi = {};
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
}) ;

export { wasiAll as default };
