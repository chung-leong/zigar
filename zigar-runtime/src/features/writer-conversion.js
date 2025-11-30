import { mixin } from '../environment.js';
import { ArrayWriter, NullStream, Uint8ArrayReadWriter, WebStreamWriter } from '../streams.js';

export default mixin({
  convertWriter(arg) {
    if (arg instanceof WritableStream || arg instanceof WritableStreamDefaultWriter) {
      return new WebStreamWriter(arg);
    } else if (Array.isArray(arg)) {
      return new ArrayWriter(arg);
    } else if (arg instanceof Uint8Array) {
      return new Uint8ArrayReadWriter(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (typeof(arg?.write) === 'function') {
      return arg;
    }
  },
});

