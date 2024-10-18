import { mixin } from '../environment.js';
import { CONTEXT, MEMORY } from '../symbols.js';

export default mixin({
  createSignalArray(args, structure, signal) {
    const { constructor: { child: Int32 } } = structure.instance.members[0].structure;
    const int32 = new Int32(signal?.aborted ? 1 : 0);
    if (signal) {
      signal.addEventListener('abort', () => {
        if (process.env.TARGET === 'wasm') {
          // WASM doesn't directly access JavaScript memory, we need to find the
          // shadow memory that's been assigned to the object and store the value there
          const shadow = this.findShadow(args[CONTEXT], int32);
          const shadowInt32 = Int32(shadow[MEMORY]);
          Atomics.store(shadowInt32.typedArray, 0, 1);
        } else if (process.env.TARGET === 'node') {
          // node has direct access on the other hand
          Atomics.store(int32.typedArray, 0, 1);
        }
      }, { once: true });
    }
    return int32;
  },
});
