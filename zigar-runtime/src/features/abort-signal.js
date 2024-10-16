import { mixin } from '../environment.js';

export default mixin({
  createSignalArray(signal) {
    const array = new Int32Array(1);
    if (signal) {
      if (signal.aborted) {
        array[0] = 1;
      } else {
        signal.addEventListener('abort', () => {
          Atomics.store(array, 0, 1);
        }, { once: true });
      }
    }
    return array;
  },
});
