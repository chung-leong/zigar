import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { markAsSpecial } from '../utils.js';

var typedArray = mixin({
  defineTypedArray(structure) {
    const thisEnv = this;
    const TypedArray = this.getTypedArray(structure); // (from mixin "structures/all")
    return markAsSpecial({
      get() {
        const dv = this.dataView;
        const length = dv.byteLength / TypedArray.BYTES_PER_ELEMENT;
        return new TypedArray(dv.buffer, dv.byteOffset, length);
      },
      set(ta, allocator) {
        if (ta?.[Symbol.toStringTag] !== TypedArray.name) {
          throw new TypeMismatch(TypedArray.name, ta);
        }
        const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
        thisEnv.assignView(this, dv, structure, true, allocator);
      },
    });
  },
});

export { typedArray as default };
