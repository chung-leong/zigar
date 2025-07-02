import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

var random = mixin({
  randomGet(buf_address, buf_len) {
    const dv = new DataView(this.memory.buffer);
    for (let i = 0; i < buf_len; i++) {
      dv.setUint8(buf_address + i, Math.floor(256 * Math.random()));
    }
    return PosixError.NONE;
  }
}) ;

export { random as default };
