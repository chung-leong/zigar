import { mixin } from '../environment.js';
import { IllegalSeek, InvalidFileDescriptor, TypeMismatch } from '../errors.js';
import { decodeText } from '../utils.js';

export default mixin({
  init() {
    const c = this.console = new ConsoleWriter();
    this.streamMap = new Map([ [ 1, c ], [ 2, c ] ]);
    this.nextStreamHandle = 0x7fff_ffff;
  },
  getStream(fd) {
    const stream = this.streamMap.get(fd);
    if (!stream) throw new InvalidFileDescriptor();
    return stream;
  },
  createHandle(arg) {
    let stream;
    try {
      stream = this.convertReader(arg);
    } catch {
      try {
        stream = this.convertWriter(arg);
      } catch {
        throw new TypeMismatch('reader or writer', arg);
      }
    }
    const handle = this.nextStreamHandle++;
    this.streamMap.set(handle, stream);
    return handle;
  },
  writeBytes(fd, address, len) {
    const array = this.obtainZigArray(address, len, false);
    const writer = this.getStream(fd);
    return writer.write(array);
  },
  readBytes(fd, address, len) {
    const array = this.obtainZigArray(address, len, false);
    const reader = this.getStream(fd);
    return reader.read(array);
  },
  changeStreamPointer(fd, offset, whence) {
    const reader = this.getStream(fd);
    if (typeof(reader.seek) !== 'function') {
      throw new IllegalSeek();
    }
    return reader.seek(offset, whence);
  },
  getStreamPointer(fd) {
    const reader = this.getStream(fd);
    if (typeof(reader.tell) !== 'function') {
      throw new IllegalSeek();
    }
    return reader.tell();
  },
  closeStream(fd) {
    this.streamMap.delete(fd);
  },
  redirectStream(fd, arg) {
    if (fd === 0) {
      this.streamMap.set(fd, this.convertReader(arg));
    } else if (fd === 1 || fd === 2) {
      this.streamMap.set(fd, this.convertWriter(arg));
    } else {
      throw new Error(`Expecting 0, 1, or 2, received ${fd}`);
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      flushStdout: { argType: '', returnType: '' },
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      writeBytes: null,
      readBytes: null,
    },
    imports: {
      flushStdout: null,
    },
    /* c8 ignore start */
  } : undefined),
  ...(process.env.MIXIN === 'track' ? {
    usingStream: false,
  } : undefined),
    /* c8 ignore end */
});

class ConsoleWriter {
  dest = null;
  pending = [];
  timeout = 0;

  use(console) {
    this.dest = console;
  }

  write(chunk) {
    try {
      // make copy of array, in case incoming buffer is pointing to stack memory
      const array = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength).slice();
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.pending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.subarray(index + 1);
        this.writeNow([ ...this.pending, beginning ]);
        this.pending.splice(0);
        if (remaining.length > 0) {
          this.pending.push(remaining);
        }
      }
      clearTimeout(this.timeout);
      this.timeout = 0;
      if (this.pending.length > 0) {
        this.timeout = setTimeout(() => {
          this.writeNow(this.pending);
          this.pending.splice(0);
        }, 250);
      }
    /* c8 ignore start */
    } catch (err) {
      console.error(err);
    }
    /* c8 ignore end */
  }

  writeNow(array) {
    const c = this.dest ?? globalThis.console;
    c.log?.call?.(c, decodeText(array));
  }

  flush() {
    if (this.pending.length > 0) {
      this.writeNow(this.pending);
      this.pending.splice(0);
      clearTimeout(this.timeout);
    }
  }
}

