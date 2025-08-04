import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { WebStreamReaderBYOB, BlobReader, Uint8ArrayReadWriter, NullStream } from '../streams.js';
import { hasMethod } from '../utils.js';

var readerConversion = mixin({
  convertReader(arg) {
    if (arg instanceof ReadableStreamDefaultReader) {
      return new WebStreamReader(arg);
    } else if(arg instanceof ReadableStreamBYOBReader) {
      return new WebStreamReaderBYOB(arg);
    } else if (arg instanceof Blob) {
      return new BlobReader(arg);
    } else if (arg instanceof Uint8Array) {
      return new Uint8ArrayReadWriter(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (hasMethod(arg, 'read')) {
      return arg;
    } else {
      throw new TypeMismatch('ReadableStreamDefaultReader, ReadableStreamBYOBReader, Blob, Uint8Array, or object with reader interface', arg);
    }
  }
});

export { readerConversion as default };
