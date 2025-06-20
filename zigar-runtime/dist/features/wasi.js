import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var wasi = mixin({
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
        ?? (() => PosixError.ENOSYS);
  },
}) ;

export { wasi as default };
