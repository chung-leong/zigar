import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { createView } from '../utils.js';

var randomGet = mixin({
  randomGet(bufAddress, bufLen) {
    const dv = createView(bufLen);
    for (let i = 0; i < bufLen; i++) {
      dv.setUint8(i, Math.floor(256 * Math.random()));
    }
    this.moveExternBytes(dv, bufAddress, true);
    return PosixError.NONE;
  }
}) ;

export { randomGet as default };
