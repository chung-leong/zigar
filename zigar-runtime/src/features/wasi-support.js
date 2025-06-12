import { CallResult } from '../constants.js';
import { mixin } from '../environment.js';
import { Exit } from '../errors.js';
import { isPromise } from '../utils.js';

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
      const custom = this.customWASI?.wasiImport?.[name];
      if (custom) {
        return custom;
      }
      const ENOSYS = 38;
      const ENOBADF = 8;
      switch (name) {
        case 'fd_write':
          return (fd, iovs_ptr, iovs_count, written_ptr) => {
            const dv = new DataView(this.memory.buffer);
            let written = 0;
            for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
              const buf_ptr = dv.getUint32(p, true);
              const buf_len = dv.getUint32(p + 4, true);
              if (buf_len > 0) {
                const result = this.writeBytes(fd, buf_ptr, buf_len);
                if (!isPromise(result) && result !== CallResult.OK) return ENOSYS;
                written += buf_len;
              }
            }
            dv.setUint32(written_ptr, written, true);
            return 0;
          };
        case 'fd_read':
          return (fd, iovs_ptr, iovs_count, read_ptr) => {
            const dv = new DataView(this.memory.buffer);
            let read = 0;
            for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
              const buf_ptr = dv.getUint32(p, true);
              const buf_len = dv.getUint32(p + 4, true);
              if (buf_len > 0) {
                const result = this.readBytes(fd, buf_ptr, buf_len);
                if (result !== CallResult.OK) return ENOSYS;
                read += buf_len;
              }
            }
            dv.setUint32(read_ptr, read, true);
            return 0;
          };
        case 'fd_seek':
          return (fd, offset, whence, newoffset_ptr) => {
            const dv = new DataView(this.memory.buffer);
            const pos = this.changeStreamPointer(fd, offset, whence);
            if (pos === undefined) return ENOSYS;
            dv.setUint32(newoffset_ptr, pos, true);
            return 0;
          };
        case 'fd_tell':
          return (fd, newoffset_ptr) => {
            const dv = new DataView(this.memory.buffer);
            const pos = this.getStreamPointer(fd);
            if (pos === undefined) return ENOSYS;
            dv.setUint32(newoffset_ptr, pos, true);
            return 0;
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
  } : undefined),
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagCallWasiSupport() {
      this.showDiagnostics('WASI support', [
        `Custom handlers: ${!!this.customWASI}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});
