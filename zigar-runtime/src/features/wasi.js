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
      if (process.env.MIXIN === 'track') {
        this.usingWasi ??= {};
        switch (name) {
          case 'proc_exit': this.usingWasi.Exit = true; break;
          case 'fd_prestat_get': this.usingWasi.PrestatGet = true; break;
          case 'random_get': this.usingWasi.RandomGet = true; break;
          case 'fd_write': this.usingWasi.Write = true; break;
          case 'fd_read': this.usingWasi.Read = true; break;
          case 'fd_seek': this.usingWasi.Seek = true; break;
          case 'fd_tell': this.usingWasi.Tell = true; break;
        }
        switch (name) {
          case 'fd_seek':
          case 'fd_tell': 
            this.usingStreamReposition = true;
            /* fall through */
          case 'fd_write':
          case 'fd_read':
            this.usingStreamRedirection = true;
            break;
        }
      }
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
