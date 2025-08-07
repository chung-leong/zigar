import { InvalidArgument, WouldBlock } from './errors.js';
import { empty } from './utils.js';

export class AsyncReader {
  bytes = null;
  promise = null;
  done = false;  

  readnb(len) {
    if (!this.bytes) {
      if (!this.promise) {
        this.promise = this.fetch(len).then(() => this.promise = null);
      }
      throw new WouldBlock();
    }
    return this.shift(len);
  }

  async read(len) {
    if (this.promise) {
      // wait for outstanding non-blocking retrieval
      await this.promise;
    }
    // keep reading until there's enough bytes to cover the request length
    while ((!this.bytes || this.bytes.length < len) && !this.done) {
      await this.fetch(len - (this.bytes?.length ?? 0));
    }
    return this.shift(len);
  }

  store(chunk) {
    if (!chunk) {
      this.done = true;
      return;
    }
    if (!(chunk instanceof Uint8Array)) {
      if (chunk instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk);
      } else if (value.buffer instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      } else {
        return;
      }
    }
    if (!this.bytes) {
      this.bytes = chunk;
    } else {
      const len1 = this.bytes.length, len2 = chunk.length;
      const array = new Uint8Array(len1 + len2);
      array.set(this.bytes);
      array.set(chunk, len1);
      this.bytes = array;
    }
  }

  shift(len) {
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
}

export class WebStreamReader extends AsyncReader {
  onClose = null;

  constructor(reader) {
    super();
    this.reader = reader;
    reader.close = () => this.onClose?.();
  }

  async fetch() {
    const { value } = await this.reader.read();
    this.store(value);
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

export class WebStreamReaderBYOB extends WebStreamReader {
  buffer = null;

  async fetch(len) {
    const buffer = new Uint8Array(len);
    const { value } = await this.reader.read(buffer);
    this.store(value);
  }
}

export class AsyncWriter {
  promise = null;

  writenb(bytes) {
    if (this.promise) {
      throw new WouldBlock();
    }
    this.promise = this.send(bytes).then(() => {
      this.promise = null;
    });
  }

  async write(bytes) {
    if (this.promise) {
      await this.promise;
    }
    await this.send(bytes);
  }
}

export class WebStreamWriter extends AsyncWriter {
  onClose = null;
  done = false;

  constructor(writer) {
    super();
    this.writer = writer;
    writer.closed.catch(empty).then(() => {
      this.done = true;
      this.onClose?.();
    });
  }

  async send(bytes) {
    await this.writer.write(bytes);
  }

  destroy() {
    if (!this.done) {
      this.writer.close();
    }
  }
}

export class BlobReader extends AsyncReader {
  pos = 0n;
  onClose = null;

  constructor(blob) {
    super();
    this.blob = blob;
    this.size = BigInt(blob.size);
    blob.close = () => this.onClose?.();
  }

  async fetch(len) {
    const chunk = await this.pread(len, this.pos);
    this.pos += BigInt(chunk.length);
    this.store(chunk.length > 0 ? chunk : null);
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
    this.done = false;
    return this.pos = reposition(whence, offset, this.pos, this.size);
  }

  valueOf() {
    return this.blob;
  }
}

export class Uint8ArrayReadWriter {
  pos = 0n;
  onClose = null;

  constructor(array) {
    this.array = array;
    this.size = BigInt(array.length);    
    array.close = () => this.onClose?.();
  }

  readnb(len) {
    return this.read(len);
  }

  read(len) {
    const buf = this.pread(len, this.pos);
    this.pos += BigInt(buf.length);
    return buf;
  }

  writenb(buf) {
    return this.write(buf);
  }

  write(buf) {
    this.pwrite(buf, this.pos);
    this.pos += BigInt(buf.length);
  }

  pread(len, offset) {
    const start = Number(offset);
    const end = start + len;
    return this.array.subarray(start, end);
  }

  pwrite(buf, offset) {
    const start = Number(offset);
    this.array.set(buf, start);
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    return this.pos = reposition(whence, offset, this.pos, this.size);
  }

  valueOf() {
    return this.array;
  }
}

export class ArrayWriter {
  constructor(array) {
    this.array = array;
    this.closeCB = null;
    array.close = () => this.onClose?.();
  }

  writenb(bytes) {
    this.write(bytes);
  }

  write(bytes) {
    this.array.push(bytes);
  }
}

export class NullStream {
  read() {
    return this.pread();
  }

  pread() {
    return new Uint8Array(0);
  }

  write() {}

  pwrite() {}
}

export class MapDirectory {
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

function reposition(whence, offset, current, size) {
  let pos = -1n;
  switch (whence) {
    case 0: pos = offset; break;
    case 1: pos = current + offset; break;
    case 2: pos = size + offset; break;
  }
  if (!(pos >= 0n && pos <= size)) throw new InvalidArgument();
  return pos;
}