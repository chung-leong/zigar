import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' ? {
    customWASI: null,

    setCustomWASI(wasi) {
      if (wasi && this.hasCodeSource) {
        throw new Error('Cannot set WASI interface after compilation has already begun (consider disabling topLevelAwait)');
      }
      this.customWASI = wasi;
    },
    getWASIImport() {
      if (this.customWASI) {
        return this.customWASI.wasiImport;
      } else {
        const ENOSYS = 38;
        const ENOBADF = 8;
        const noImpl = () => ENOSYS;
        return {
          args_get: noImpl,
          args_sizes_get: noImpl,
          clock_res_get: noImpl,
          clock_time_get: noImpl,
          environ_get: noImpl,
          environ_sizes_get: noImpl,
          fd_advise: noImpl,
          fd_allocate: noImpl,
          fd_close: noImpl,
          fd_datasync: noImpl,
          fd_pread: noImpl,
          fd_pwrite: noImpl,
          fd_read: noImpl,
          fd_readdir: noImpl,
          fd_renumber: noImpl,
          fd_seek: noImpl,
          fd_sync: noImpl,
          fd_tell: noImpl,
          fd_write: (fd, iovs_ptr, iovs_count, written_ptr) => {
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
          },
          fd_fdstat_get: noImpl,
          fd_fdstat_set_flags: noImpl,
          fd_fdstat_set_rights: noImpl,
          fd_filestat_get: noImpl,
          fd_filestat_set_size: noImpl,
          fd_filestat_set_times: noImpl,
          fd_prestat_get: () => ENOBADF,
          fd_prestat_dir_name: noImpl,
          path_create_directory: noImpl,
          path_filestat_get: noImpl,
          path_filestat_set_times: noImpl,
          path_link: noImpl,
          path_open: noImpl,
          path_readlink: noImpl,
          path_remove_directory: noImpl,
          path_rename: noImpl,
          path_symlink: noImpl,
          path_unlink_file: noImpl,
          poll_oneoff: noImpl,
          proc_exit: (code) => {
            throw new Exit(code);
          },
          random_get: (buf, buf_len) => {
            const dv = new DataView(this.memory.buffer, buf, buf_len);
            for (let i = 0; i < buf_len; i++) {
              dv.setUint8(i, Math.floor(256 * Math.random()));
            }
            return 0;
          },
          sched_yield: noImpl,
          sock_accept: noImpl,
          sock_recv: noImpl,
          sock_send: noImpl,
          sock_shutdown: noImpl,
        };
      }
    }
  } : undefined),
});
