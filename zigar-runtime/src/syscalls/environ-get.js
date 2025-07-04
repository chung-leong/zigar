import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { usize } from '../utils.js';
import './usize-copy.js';

export default mixin({
  environGet(environAddress, environBufAddress) {
    let p = environAddress, b = environBufAddress;
    for (const array of this.envVariables) {
      this.copyUsize(p, b);
      this.moveExternBytes(array, b, true);
      b += usize(array.length);
      p += usize(4);
    }
    return PosixError.NONE;
  },
});
