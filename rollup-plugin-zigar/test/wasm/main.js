import { readFileSync } from 'fs';
import { PosixError } from '../../../zigar-runtime/src/constants';

const path = './main.wasm';
const auxPath = './auxiliary.wasm';
const ENOSYS = 38;
const ENOBADF = 8;
const noImpl = () => ENOSYS;
let memory;
const decoder = new TextDecoder();
const wasi = {
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
      const dv = new DataView(memory.buffer);
      let written = 0;
      for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
        const buf_ptr = dv.getUint32(p, true);
        const buf_len = dv.getUint32(p + 4, true);
        if (buf_len > 0) {
          const buf = new Uint8Array(memory.buffer, buf_ptr, buf_len);
          const text = decoder.decode(buf);
          console.log(text);
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
  fd_prestat_get: () => PosixError.EBADF,
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
  proc_exit: noImpl,
  random_get: noImpl,
  sched_yield: noImpl,
  sock_accept: noImpl,
  sock_recv: noImpl,
  sock_send: noImpl,
  sock_shutdown: noImpl,
};
const table = new WebAssembly.Table({
  initial: 10,
  element: 'anyfunc',
});
const imports = {
  env: {
    __indirect_function_table: table
  },
  wasi_snapshot_preview1: wasi,
};
const code = readFileSync(path);
const { instance } = await WebAssembly.instantiate(code, imports);
memory = instance.exports.memory;
memory.grow(1);
const auxCode = readFileSync(auxPath);
const auxImport = {
  env: { memory },
  wasi_snapshot_preview1: wasi,
};
const { instance: auxInstance } = await WebAssembly.instantiate(auxCode, auxImport);
const { run } = instance.exports;
console.log(instance.exports);
const { hello, world } = auxInstance.exports;
console.log({ hello, world });
table.set(2, hello);
table.set(3, world);
run(2);
run(3);
