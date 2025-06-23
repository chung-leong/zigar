import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  wasi_environ_get(ctx, environ, environ_buf) {
    return PosixError.NONE;
  },
  wasi_environ_sizes_get(ctx, environ_count_address, environ_buf_size_address) {
    const dv = new DataView(this.memory.buffer);
    dv.setUint32(environ_count_address, 0, true);
    dv.setUint32(environ_buf_size_address, 0, true);
    return PosixError.NONE;
  },
});
