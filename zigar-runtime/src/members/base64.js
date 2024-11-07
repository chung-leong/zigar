import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { decodeBase64, encodeBase64, markAsSpecial } from '../utils.js';

export default mixin({
  defineBase64(structure) {
    const thisEnv = this;
    return markAsSpecial({
      get() {
        return encodeBase64(this.dataView);
      },
      set(str, allocator) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const dv = decodeBase64(str);
        thisEnv.assignView(this, dv, structure, false, allocator);
      }
    });
  },
});
