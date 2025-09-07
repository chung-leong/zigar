import { PosixPollEventType } from './constants.js';
import { InvalidArgument, WouldBlock } from './errors.js';
import { empty } from './utils.js';

export class AsyncReader {
  bytes = null;
  promise = null;
  done = false;  

  readnb(len) {
    const avail = this.poll();
    if (typeof(avail) != 'number') {
      throw new WouldBlock();
    }
    return this.shift(len);
  }

  async read(len) {
    await this.poll();
    return this.shift(len);
  }

  store({ done, value: chunk }) {
    if (done) {
      this.done = true;
      return 0;
    }
    if (!(chunk instanceof Uint8Array)) {
      if (chunk instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk);
      } else if (value.buffer instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      } else {
        return 0;
      }
    }
    let len = chunk.length;
    if (!this.bytes) {
      this.bytes = chunk;
    } else {
      const remaining = this.bytes.length;
      len += remaining;
      const array = new Uint8Array(len);
      array.set(this.bytes);
      array.set(chunk, remaining);
      this.bytes = array;
    }
    return len;
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

  poll() {
    const len = this.bytes?.length;
    if (len) {
      return len;
    } else {
      return this.promise ??= this.fetch().then((chunk) => {
        this.promise = null;
        return this.store(chunk);
      });
    }
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
    return this.reader.read();
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
  async fetch() {
    const buffer = new Uint8Array(size8k);
    return this.reader.read(buffer);
  }
}

export class AsyncWriter {
  promise = null;

  writenb(bytes) {
    const avail = this.poll();
    if (typeof(avail) !== 'number') {
      throw new WouldBlock();
    }
    this.queue(bytes);
  }

  async write(bytes) {
    await this.poll();
    await this.queue(bytes);
  }

  queue(bytes) {
    return this.promise = this.send(bytes).then(() => {
      this.promise = null;
    });
  }

  poll() {
    return this.promise?.then?.(() => size16meg) ?? size16meg;
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
  pos = 0;
  onClose = null;

  constructor(blob) {
    super();
    this.blob = blob;
    this.size = blob.size;
    blob.close = () => this.onClose?.();
  }

  async fetch() {
    const chunk = await this.pread(size8k, this.pos);
    const { length } = chunk;
    return { done: !!length, value: (length) ? chunk : null };
  }

  async pread(len, offset) {
    const slice = this.blob.slice(offset, offset + len);
    const response = new Response(slice);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    this.done = false;
    this.bytes = null;
    return this.pos = reposition(whence, offset, this.pos, this.size);
  }

  valueOf() {
    return this.blob;
  }
}

export class Uint8ArrayReadWriter {
  pos = 0;
  onClose = null;

  constructor(array) {
    this.array = array;
    this.size = array.length;    
    array.close = () => this.onClose?.();
  }

  readnb(len) {
    return this.read(len);
  }

  read(len) {
    const buf = this.pread(len, this.pos);
    this.pos += buf.length;
    return buf;
  }

  writenb(buf) {
    return this.write(buf);
  }

  write(buf) {
    this.pwrite(buf, this.pos);
    this.pos += buf.length;
  }

  pread(len, offset) {
    return this.array.subarray(offset, offset + len);
  }

  pwrite(buf, offset) {
    this.array.set(buf, offset);
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    return this.pos = reposition(whence, offset, this.pos, this.size);
  }

  poll() {
    return this.size - this.pos;
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

  poll() {
    return size16meg;
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

  poll(tag) {
    return (tag === PosixPollEventType.FD_READ) ? 0 : size16meg;
  }
}

export class MapDirectory {
  onClose = null;
  keys = null;
  cookie = 0n;

  constructor(map) {
    this.map = map;
    this.size = map.size;
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

  poll() {
    return this.size - Number(this.cookie);
  }

  valueOf() {
    return this.map;
  }
}

function reposition(whence, offset, current, size) {
  let pos = -1;
  switch (whence) {
    case 0: pos = offset; break;
    case 1: pos = current + offset; break;
    case 2: pos = size + offset; break;
  }
  if (!(pos >= 0 && pos <= size)) throw new InvalidArgument();
  return pos;
}

const size8k = 8192;
const size16meg = 16777216;
