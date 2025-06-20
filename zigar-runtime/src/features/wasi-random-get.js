import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  wasi_random_get(buf, buf_len) {
    const dv = new DataView(this.memory.buffer, buf, buf_len);
    for (let i = 0; i < buf_len; i++) {
      dv.setUint8(i, Math.floor(256 * Math.random()));
    }
    return PosixError.NONE;
  }
}) : undefined;
