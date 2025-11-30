import { PosixPollEventType } from './constants.js';
import { InvalidArgument, WouldBlock } from './errors.js';
import { defineProperty, empty, encodeText } from './utils.js';

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
      } else if (chunk.buffer instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      } else {
        chunk = encodeText(chunk + '');
      }
    }
    this.bytes = chunk;
    return chunk.length;
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

  constructor(arg) {
    super();
    const reader = (arg instanceof ReadableStream) ? arg.getReader() : arg;
    this.reader = reader;
    attachClose(arg, this);
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

  constructor(arg) {
    super();
    let writer;
    if (arg instanceof WritableStream) {
      writer = arg.getWriter();
      // replace close function with one that closes the writer
      arg.close = async () => {
        delete arg.close;
        await writer.close();
        writer.releaseLock();
      };
    } else {
      writer = arg;
    }
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

  valueOf() {
    return this.writer;
  }
}

export class BlobReader extends AsyncReader {
  pos = 0;
  onClose = null;

  constructor(blob) {
    super();
    this.blob = blob;
    this.size = blob.size;
    attachClose(blob, this);
  }

  async fetch() {
    const chunk = await this.pread(size8k, this.pos);
    const { length } = chunk;
    return { done: !length, value: (length) ? chunk : null };
  }

  async pread(len, offset) {
    const slice = this.blob.slice(offset, offset + len);
    const response = new Response(slice);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  
  async read(len) {
    const chunk = await super.read(len);
    this.pos += chunk.length;
    return chunk;
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

class Uint8ArrayReader {
  pos = 0;
  onClose = null;

  constructor(array) {
    this.array = array;
    this.size = array.length;    
    attachClose(array, this);
  }

  readnb(len) {
    return this.read(len);
  }

  read(len) {
    const buf = this.pread(len, this.pos);
    this.pos += buf.length;
    return buf;
  }

  pread(len, offset) {
    return this.array.subarray(offset, offset + len);
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

export class Uint8ArrayReadWriter extends Uint8ArrayReader {
  writenb(buf) {
    return this.write(buf);
  }

  write(buf) {
    this.pwrite(buf, this.pos);
    this.pos += buf.length;
  }

  pwrite(buf, offset) {
    this.array.set(buf, offset);
  }
}

export class StringReader extends Uint8ArrayReader {
  constructor(string) {
    super(encodeText(string));
    this.string = string;
    attachClose(string, this);
  }

  valueOf() {
    return this.string;
  }
}

export class ArrayWriter {
  constructor(array) {
    this.array = array;
    this.closeCB = null;
    attachClose(array, this);
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

  valueOf() {
    return this.array;
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

  valueOf() {
    return null;
  }
}

export class MapDirectory {
  onClose = null;
  keys = null;
  cookie = 0;

  constructor(map) {
    this.map = map;
    this.size = map.size;
    attachClose(map, this);
  }

  readdir() {
    const offset = this.cookie;
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
  let pos = -1;
  switch (whence) {
    case 0: pos = offset; break;
    case 1: pos = current + offset; break;
    case 2: pos = size + offset; break;
  }
  if (!(pos >= 0 && pos <= size)) throw new InvalidArgument();
  return pos;
}

function attachClose(target, stream) {
  if (typeof(target) === 'object') {
    const previous = target.close;
    defineProperty(target, 'close', { 
      value: () => {
        previous?.();
        stream.onClose?.();
        delete target.close;
      }
    });
  }
}

const size8k = 8192;
const size16meg = 16777216;
