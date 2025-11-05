import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import './copy-int.js';

export default mixin({
  clockResGet(clockId, resAddress) {
    this.copyUint64(resAddress, 1000n);
    return PosixError.NONE;
  },
});
