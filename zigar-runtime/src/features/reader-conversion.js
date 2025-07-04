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
  leftover = null;
  onClose = null;

  constructor(reader) {
    this.reader = reader;
    reader.close = () => this.onClose?.();
  }

  async read(dest) {
    let read = 0;
    while (read < dest.length && !this.done) {
      if (!this.leftover) {
        const { done, value } = await this.reader.read();
        this.done = done;
        this.leftover = new Uint8Array(value);
      } 
      const len = Math.min(this.leftover.length, dest.length - read);
      for (let i = 0; i < len; i++) dest[read + i] = this.leftover[i]; 
      read += len;
      if (this.leftover.length > len) {
        this.leftover = this.leftover.slice(len);
      } else {
        this.leftover = null;
      }
    }
    return read;
  }

  destroy() {
    if (!this.done) {
      this.reader.cancel();
    }
  }

  valueOf() {
    return this.reader;
  }
}

class WebStreamReaderBYOB extends WebStreamReader {
  async read(dest) {
    let read = 0;
    if (!this.done) {
      const { done, value } = await this.reader.read(dest);
      this.done = done;
      read = value.byteLength;
    }
    return read;
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

  async read(dest) {
    const len = dest.length;
    const pos = Number(this.pos);
    const slice = this.blob.slice(pos, pos + len);
    const response = new Response(slice);
    const buffer = await response.arrayBuffer();
    return this.copy(dest, new Uint8Array(buffer));
  }

  copy(dest, src) {
    const read = src.length;
    for (let i = 0; i < read; i++) dest[i] = src[i];
    this.pos += BigInt(read);
    return read;
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
  read(dest) {
    const pos = Number(this.pos);
    return this.copy(dest, this.blob.slice(pos, pos + dest.length));
  }
}

export class NullStream {
  read() {
    return 0;
  }

  write() {}
}
