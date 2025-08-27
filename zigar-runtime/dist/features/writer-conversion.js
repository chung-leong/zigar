import { mixin } from '../environment.js';
import { WebStreamWriter, ArrayWriter, Uint8ArrayReadWriter, NullStream } from '../streams.js';

var writerConversion = mixin({
  convertWriter(arg) {
    if (arg instanceof WritableStreamDefaultWriter) {
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

export { writerConversion as default };
