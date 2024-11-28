import { mixin } from '../environment.js';
import { MEMORY } from '../symbols.js';

var abortSignal = mixin({
  createSignalArray(args, structure, signal) {
    const { constructor: { child: Int32 } } = structure.instance.members[0].structure;
    const ta = new Int32Array([ signal?.aborted ? 1 : 0 ]);
    const int32 = Int32(ta);
    if (signal) {
      signal.addEventListener('abort', () => {
        {
          // WASM doesn't directly access JavaScript memory, we need to find the
          // shadow memory that's been assigned to the object and store the value there
          const shadowDV = this.findShadowView(int32[MEMORY]);
          const shadowTA = new Int32Array(shadowDV.buffer, shadowDV.byteOffset, 1);
          Atomics.store(shadowTA, 0, 1);
        }
      }, { once: true });
    }
    return int32;
  },
});

export { abortSignal as default };
