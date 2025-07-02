import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  environGet(environ_address, environ_buf_address) {
    const dv = new DataView(this.memory.buffer);
    const env = this.getEnvVariables();
    let p = environ_address, b = environ_buf_address;
    for (const array of env) {
      dv.setUint32(p, b, true);
      for (let i = 0; i < array.length; i++) {
        dv.setUint8(b++, array[i]);
      }
      dv.setUint8(b++, 0);
      p += 4;
    }
    return PosixError.NONE;
  },
  environSizesGet(environ_count_address, environ_buf_size_address) {
    const dv = new DataView(this.memory.buffer);
    const env = this.getEnvVariables();
    let size = 0;
    for (const array of env) {
      size += array.length + 1;
    }
    dv.setUint32(environ_count_address, env.length, true);
    dv.setUint32(environ_buf_size_address, size, true);
    return PosixError.NONE;
  },
  getEnvVariables() {
    let env = this.envVariables;
    if (!env) {
      const listener = this.listenerMap.get('env');
      const result = listener?.() ?? {};
      if (typeof(result) !== 'object') {
        throw new TypeMismatch('object', result);
      }
      env = this.envVariables = [];
      for (const [ name, value ] of Object.entries(result)) {
        const array = encodeText(`${name}=${value}`);
        env.push(array);
      }
    }
    return env;
  },
});
