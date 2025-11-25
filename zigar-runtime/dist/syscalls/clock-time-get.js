import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import './copy-int.js';

var clockTimeGet = mixin({
  clockTimeGet(clockId, precision, timeAddress) {
    const t = (clockId === 0) ? Date.now() : performance.now();
    this.copyUint64(timeAddress, BigInt(Math.ceil(t * 1000000)));
    return PosixError.NONE;
  },
});

export { clockTimeGet as default };
