import { mixin } from '../environment.js';
import { InvalidArgument, TypeMismatch } from '../errors.js';
import { hasMethod } from '../utils.js';

export default mixin({
  convertReader(arg) {
    if (arg instanceof ReadableStreamDefaultReader) {
      return new WebStreamReader(arg);
    } else if(arg instanceof ReadableStreamBYOBReader) {
      return new WebStreamReaderBYOB(arg);
    } else if (arg instanceof Blob) {
      return new BlobReader(arg);
    } else if (arg instanceof Uint8Array) {
      return new Uint8ArrayReader(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (hasMethod(arg, 'read')) {
      return arg;
    } else {
      throw new TypeMismatch('ReadableStreamDefaultReader, ReadableStreamBYOBReader, Blob, Uint8Array, or object with reader interface', arg);
    }
  }
});

class WebStreamReader {
  done = false;  
  bytes = null;
  onClose = null;

  constructor(reader) {
    this.reader = reader;
    reader.close = () => this.onClose?.();
  }

  async read(len) {
    // keep reading until there's enough bytes to cover the request length
    while ((!this.bytes || this.bytes.length < len) && !this.done) {
      let { value } = await this.reader.read();
      if (value) {
        if (!(value instanceof Uint8Array)) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          } else if (value.buffer instanceof ArrayBuffer) {
            value = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          }
        }
        if (!this.bytes) {
          this.bytes = value;
        } else {
          const len1 = this.bytes.length, len2 = value.length;
          const array = new Uint8Array(len1 + len2);
          array.set(this.bytes);
          array.set(value, len1);
          this.bytes = array;
        }
      } else {
        this.done = true;
      }
    }
    let chunk;
    if (this.bytes) {
      if (this.bytes.length > len) {
        chunk = this.bytes.subarray(0, len);
        this.bytes = this.bytes.subarray(len);
      } else {
        chunk = this.bytes;
        this.bytes = null;
      }
    }
    return chunk ?? new Uint8Array(0);
  }

  destroy() {
    if (!this.done) {
      this.reader.cancel();
    }
    this.bytes = null;
  }

  valueOf() {
    return this.reader;
  }
}

class WebStreamReaderBYOB extends WebStreamReader {
  bytes = null;

  async read(len) {
    if (!this.bytes || this.bytes.length < len) {
      this.bytes = new Uint8Array(len);
    }
    let chunk;
    if (!this.done) {
      const { value } = await this.reader.read(this.bytes);
      if (value) {
        chunk = value;
      } else {
        this.done = true;
      }
    }
    return chunk ?? new Uint8Array(0);
  }
}

class BlobReader {
  pos = 0n;
  onClose = null;

  constructor(blob) {
    this.blob = blob;
    this.size = BigInt(blob.size ?? blob.length);
    blob.close = () => this.onClose?.();
  }

  async read(len) {
    const start = Number(this.pos);
    const end = start + len;
    const slice = this.blob.slice(start, end);
    const response = new Response(slice);
    const buffer = await response.arrayBuffer();
    this.pos = BigInt(end);
    return new Uint8Array(buffer);
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    const { size } = this;
    let pos = -1n;
    switch (whence) {
      case 0: pos = offset; break;
      case 1: pos = this.pos + offset; break;
      case 2: pos = size + offset; break;
    }
    if (!(pos >= 0n && pos <= size)) throw new InvalidArgument();
    return this.pos = pos;
  }

  valueOf() {
    return this.blob;
  }
}

class Uint8ArrayReader extends BlobReader {
  read(len) {
    const start = Number(this.pos);
    const end = start + len;
    this.pos = BigInt(end);
    return this.blob.subarray(start, end);
  }
}

export class NullStream {
  read() {
    return 0;
  }

  write() {}
}
