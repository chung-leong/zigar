import { mixin } from '../environment.js';
import { MEMORY, ZIG } from '../symbols.js';
import { copyView } from '../utils.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' ? {
    defineRetvalCopier({ byteSize, bitOffset }) {
      if (byteSize > 0) {
        const thisEnv = this;
        const offset = bitOffset >> 3;
        return {
          value(shadowDV) {
            const dv = this[MEMORY];
            const { address } = shadowDV[ZIG];
            const src = new DataView(thisEnv.memory.buffer, address + offset, byteSize);
            const dest = new DataView(dv.buffer, dv.byteOffset + offset, byteSize);
            copyView(dest, src);
          }
        };
      }
    },
  } : undefined),
});
