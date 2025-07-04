import { mixin } from '../environment.js';
import { MEMORY } from '../symbols.js';

var abortSignal = mixin({
  createSignal(structure, signal) {
    const { constructor: { child: Int32 } } = structure.instance.members[0].structure;
    const ta = new Int32Array([ signal?.aborted ? 1 : 0 ]);
    const int32 = Int32(ta);
    if (signal) {
      signal.addEventListener('abort', () => {
        {
          // WASM doesn't directly access JavaScript memory, we need to find the
          // shadow memory that's been assigned to the object and store the value there
          const shadowDV = this.findShadowView(int32[MEMORY]);
          if (shadowDV) {
            // we'd only find the shadow before the function return
            // nothing happens if the controller's fired afterward
            const shadowTA = new Int32Array(shadowDV.buffer, shadowDV.byteOffset, 1);
            Atomics.store(shadowTA, 0, 1);
          }
        }
      }, { once: true });
    }
    return { ptr: int32 };
  },
  createInboundSignal(signal) {
    const controller = new AbortController();
    if (signal.ptr['*']) {
      controller.abort();
    } else {
      const interval = setInterval(() => {
        if (signal.ptr['*']) {
          controller.abort();
          clearInterval(interval);
        }
      }, 50);
    }
    return controller.signal;
  },
});

export { abortSignal as default };
