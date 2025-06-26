import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { encodeText } from '../utils.js';

export default mixin({
  getEnvVariables() {
    let env = this.envVariables;
    if (!env) {
      const listener = this.listenerMap.get('env');
      const result = listener?.() ?? {};
      if (typeof(result) !== 'object') {
        throw TypeMismatch('object', result);
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
