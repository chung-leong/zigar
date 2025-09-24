import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { encodeText } from '../utils.js';
import './copy-int.js';

export default mixin({
  environSizesGet(environCountAddress, environBufSizeAddress) {
    const object = this.envVariables;
    if (!object) {
      return PosixError.ENOTSUP;
    }
    const env = this.envVarArrays = [];
    for (const [ name, value ] of Object.entries(object)) {
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
  ...(process.env.TARGET === 'node' ? {
    exports: {
      environSizesGet: {},
    },
    /* c8 ignore next */
  } : undefined),
});
