import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' ? {
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
  } : undefined),
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagCallWasiSupport() {
      const list = [];
      for (const [ name, value ] of Object.entries(this)) {
        if (typeof(value) === 'function' && name.startsWith('wasi_')) {
          list.push(name.slice(5));
        }
      }
      this.showDiagnostics('WASI support', [
        `Handlers: ${list.join(', ')}`,
        `Custom handlers: ${!!this.customWASI}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});
