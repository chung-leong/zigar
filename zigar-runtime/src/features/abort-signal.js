import { mixin } from '../environment.js';
import { MEMORY } from '../symbols.js';

export default mixin({
  createSignalArray(args, structure, signal) {
    const { constructor: { child: Int32 } } = structure.instance.members[0].structure;
    const ta = new Int32Array([ signal?.aborted ? 1 : 0 ]);
    const int32 = Int32(ta);
    if (signal) {
      signal.addEventListener('abort', () => {
        if (process.env.TARGET === 'wasm') {
          // WASM doesn't directly access JavaScript memory, we need to find the
          // shadow memory that's been assigned to the object and store the value there
          const shadowDV = this.findShadowView(int32[MEMORY]);
          const shadowTA = new Int32Array(shadowDV.buffer, shadowDV.byteOffset, 1);
          Atomics.store(shadowTA, 0, 1);
        } else if (process.env.TARGET === 'node') {
          // node has direct access on the other hand
          Atomics.store(ta, 0, 1);
        }
      }, { once: true });
    }
    return int32;
  },
});
