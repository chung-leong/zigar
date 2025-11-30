import { mixin } from '../environment.js';
import { WebStreamReader, WebStreamReaderBYOB, BlobReader, Uint8ArrayReadWriter, StringReader, NullStream } from '../streams.js';
import { hasMethod } from '../utils.js';

var readerConversion = mixin({
  convertReader(arg) {
    if (arg instanceof ReadableStream || arg instanceof ReadableStreamDefaultReader) {
      return new WebStreamReader(arg);
    } else if(typeof(ReadableStreamBYOBReader) === 'function' && arg instanceof ReadableStreamBYOBReader) {
      return new WebStreamReaderBYOB(arg);
    } else if (arg instanceof Blob) {
      return new BlobReader(arg);
    } else if (arg instanceof Uint8Array) {
      return new Uint8ArrayReadWriter(arg);
    } else if (typeof(arg) === 'string' || arg instanceof String) {
      return new StringReader(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (hasMethod(arg, 'read')) {
      return arg;
    }
  }
});

export { readerConversion as default };
