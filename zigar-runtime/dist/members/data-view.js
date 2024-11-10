import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { RESTORE, MEMORY } from '../symbols.js';
import { markAsSpecial } from '../utils.js';

var dataView = mixin({
  defineDataView(structure) {
    const thisEnv = this;
    return markAsSpecial({
      get() {
        {
          this[RESTORE]?.();
        }
        const dv = this[MEMORY];
        return dv;
      },
      set(dv, allocator) {
        if (dv?.[Symbol.toStringTag] !== 'DataView') {
          throw new TypeMismatch('DataView', dv);
        }
        thisEnv.assignView(this, dv, structure, true, allocator);
      },
    });
  },
  ...(undefined)
});

export { dataView as default };
