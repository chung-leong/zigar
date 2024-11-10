import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

var wasiSupport = mixin({
  ...({
    customWASI: null,

    setCustomWASI(wasi) {
      if (wasi && this.executable) {
        throw new Error('Cannot set WASI interface after compilation has already begun');
      }
      this.customWASI = wasi;
    },
    getWASIHandler(name) {
      const custom = this.customWASI?.wasiImport?.[name];
      if (custom) {
        return custom;
      }
      const ENOSYS = 38;
      const ENOBADF = 8;
      switch (name) {
        case 'fd_write':
          return (fd, iovs_ptr, iovs_count, written_ptr) => {
            if (fd === 1 || fd === 2) {
              const dv = new DataView(this.memory.buffer);
              let written = 0;
              for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
                const buf_ptr = dv.getUint32(p, true);
                const buf_len = dv.getUint32(p + 4, true);
                if (buf_len > 0) {
                  const buf = new DataView(this.memory.buffer, buf_ptr, buf_len);
                  this.writeToConsole(buf);
                  written += buf_len;
                }
              }
              dv.setUint32(written_ptr, written, true);
              return 0;
            } else {
              return ENOSYS;
            }
          };
        case 'fd_prestat_get':
          return () => ENOBADF;
        case 'proc_exit':
          return (code) => {
            throw new Exit(code);
          };
        case 'random_get':
          return (buf, buf_len) => {
            const dv = new DataView(this.memory.buffer, buf, buf_len);
            for (let i = 0; i < buf_len; i++) {
              dv.setUint8(i, Math.floor(256 * Math.random()));
            }
            return 0;
          };
        default:
          return () => ENOSYS;
      }
    },
  } ),
});

export { wasiSupport as default };
