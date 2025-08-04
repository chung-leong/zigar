import { InvalidArgument } from './errors.js';
import { empty } from './utils.js';

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

class WebStreamWriter {
  onClose = null;
  done = false;

  constructor(writer) {
    this.writer = writer;
    writer.closed.catch(empty).then(() => {
      this.done = true;
      this.onClose?.();
    });
  }

  async write(bytes) {
    await this.writer.write(bytes);
  }

  destroy() {
    if (!this.done) {
      this.writer.close();
    }
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
    const buf = await this.pread(len, this.pos);
    this.pos += BigInt(buf.length);
    return buf;
  }

  async pread(len, offset) {
    const start = Number(offset);
    const slice = this.blob.slice(start, start + len);
    const response = new Response(slice);
    const buffer = await response.arrayBuffer();
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

class Uint8ArrayReadWriter extends BlobReader {
  read(len) {
    const buf = this.pread(len, this.pos);
    this.pos = BigInt(buf.length);
    return buf;
  }

  write(buf) {
    this.pwrite(buf, this.pos);
    this.pos += BigInt(buf.length);
  }

  pread(len, offset) {
    const start = Number(offset);
    const end = start + len;
    this.pos = BigInt(end);
    return this.blob.subarray(start, end);
  }

  pwrite(buf, offset) {
    const start = Number(offset);
    this.blob.set(buf, start);
  }
}

class ArrayWriter {
  constructor(array) {
    this.array = array;
    this.closeCB = null;
    array.close = () => this.onClose?.();
  }

  write(bytes) {
    this.array.push(bytes);
  }
}

class NullStream {
  read() {
    return this.pread();
  }

  pread() {
    return new Uint8Array(0);
  }

  write() {}

  pwrite() {}
}

class MapDirectory {
  onClose = null;
  keys = null;
  cookie = 0n;

  constructor(map) {
    this.map = map;
    map.close = () => this.onClose?.();
  }

  readdir() {
    const offset = Number(this.cookie);
    let dent;
    switch (offset) {
      case 0:
      case 1: 
        dent = { name: '.'.repeat(offset + 1), type: 'directory' };
        break;
      default:
        if (!this.keys) {
          this.keys = [ ...this.map.keys() ];
        }
        const name = this.keys[offset - 2];
        if (name === undefined) {
          return null;
        }
        const stat = this.map.get(name);
        dent = { name, ...stat };        
    }
    this.cookie++;
    return dent;
  }

  seek(cookie) {
    return this.cookie = cookie;
  }

  tell() {
    return this.cookie;
  }

  valueOf() {
    return this.map;
  }
}

export { ArrayWriter, BlobReader, MapDirectory, NullStream, Uint8ArrayReadWriter, WebStreamReader, WebStreamReaderBYOB, WebStreamWriter };
