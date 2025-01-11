import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { FALLBACK, MEMORY, RESTORE } from '../symbols.js';
import { markAsSpecial } from '../utils.js';

export default mixin({
  defineDataView(structure) {
    const thisEnv = this;
    return markAsSpecial({
      get() {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
        }
        const dv = this[MEMORY];
        if (process.env.TARGET === 'node' && thisEnv.usingBufferFallback()) {
          const address = dv.buffer[FALLBACK];
          if (address !== undefined) {
            thisEnv.syncExternalBuffer(dv.buffer, address);
          }
        }
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
  ...(process.env.TARGET === 'node' ? {
    imports: {
      syncExternalBuffer: null,
    },
  } : undefined),
});
