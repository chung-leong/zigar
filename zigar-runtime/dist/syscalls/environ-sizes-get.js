import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { encodeText } from '../utils.js';
import './copy-int.js';

var environSizesGet = mixin({
  environSizesGet(environCountAddress, environBufSizeAddress) {
    const listener = this.listenerMap.get('env');
    const result = listener?.() ?? {};
    if (typeof(result) !== 'object') {
      throw new TypeMismatch('object', result);
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
    this.copyUsize(environCountAddress, env.length);
    this.copyUsize(environBufSizeAddress, size);
    return PosixError.NONE;
  },
});

export { environSizesGet as default };
