import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { encodeText } from '../utils.js';
import './copy-int.js';

var environSizesGet = mixin({
  environSizesGet(environCountAddress, environBufSizeAddress) {
    const result = this.triggerEvent('env') ?? {};
    if (typeof(result) !== 'object') {
      console.error(new TypeMismatch('object', result).message);
      return PosixError.EFAULT;
    }
    const env = this.envVariables = [];
    for (const [ name, value ] of Object.entries(result)) {
      const array = encodeText(`${name}=${value}\0`);
      env.push(array);
    }
    let size = 0;
    for (const array of env) {
      size += array.length;
    }    
    this.copyUint32(environCountAddress, env.length);
    this.copyUint32(environBufSizeAddress, size);
    return 0;
  },
});

export { environSizesGet as default };
