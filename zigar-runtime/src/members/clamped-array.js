import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { markAsSpecial } from '../utils.js';

export default mixin({
  defineClampedArray(structure) {
    const thisEnv = this;
    const ClampedArray = Uint8ClampedArray;
    return markAsSpecial({
      get() {
        const ta = this.typedArray;
        return new ClampedArray(ta.buffer, ta.byteOffset, ta.length);
      },
      set(ta, allocator) {
        if (ta?.[Symbol.toStringTag] !== ClampedArray.name) {
          throw new TypeMismatch(ClampedArray.name, ta);
        }
        const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
        thisEnv.assignView(this, dv, structure, true, allocator);
      },
    });
  },
});
