import { mixin } from '../environment.js';
import { InvalidFileDescriptor, TypeMismatch } from '../errors.js';
import { decodeText } from '../utils.js';

export default mixin({
  init() {
    const w1 = this.createLogWriter(1);
    const w2 = this.createLogWriter(2);
    this.logWriters = { 1: w1, 2: w2 };
    this.streamMap = new Map([ [ 1, w1 ], [ 2, w2 ] ]);
    this.flushRequestMap = new Map();
    this.nextStreamHandle = 0xffff;
  },
  getStream(fd) {
    const stream = this.streamMap.get(fd);
    if (!stream) throw new InvalidFileDescriptor();
    return stream;
  },
  createStreamHandle(arg) {
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
    const copy = new Uint8Array(array);
    const writer = this.getStream(fd);
    return writer.write(copy);
  },
  readBytes(fd, address, len) {
    const array = this.obtainZigArray(address, len, false);
    const reader = this.getStream(fd);
    return reader.read(array);
  },
  closeStream(fd) {
    this.streamMap.delete(fd);
  },
  redirectStream(fd, arg) {
    const map = this.streamMap;
    const previous = map.get(fd);
    if (arg !== undefined) {
      if (fd === 0) {
        map.set(fd, this.convertReader(arg));
      } else if (fd === 1 || fd === 2) {
        map.set(fd, this.convertWriter(arg));
      } else {
        throw new Error(`Expecting 0, 1, or 2, received ${fd}`);
      }
    } else {
      map.delete(fd);
    }
    return previous;
  },
  createLogWriter(handle) {
    const env = this;
    return {
      pending: [],

      write(chunk) {
          // send text up to the last newline character
          const index = chunk.lastIndexOf(0x0a);
          if (index === -1) {
            this.pending.push(chunk);
          } else {
            const beginning = chunk.subarray(0, index);
            const remaining = chunk.subarray(index + 1);
            this.dispatch([ ...this.pending, beginning ]);
            this.pending.splice(0);
            if (remaining.length > 0) {
              this.pending.push(remaining);
            }
          }
          env.scheduleFlush(this, this.pending.length > 0, 250);
      },

      dispatch(array) {
        const message = decodeText(array);
        env.listeners.log?.({ handle, message });
      },

      flush() {
        if (this.pending.length > 0) {
          this.dispatch(this.pending);
          this.pending.splice(0);
        }
      }
    };
  },
  scheduleFlush(stream, active, delay) {
    const map = this.flushRequestMap;
    const timeout = map.get(stream);
    if (timeout) {
      clearTimeout(timeout);
      map.delete(stream);
    }
    if (active) {
      map.set(stream, setTimeout(() => {
        stream.flush();
        map.delete(stream);
      }, delay));
    }
  },
  flushStreams() {
    if (this.libc) {
      this.flushStdout?.();
    }
    const map = this.flushRequestMap;
    if (map.size > 0) {
      for (const [ stream, timeout ] of map) {
        stream.flush();
        clearTimeout(timeout);
      }
      map.clear();
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
    /* c8 ignore next */
  } : undefined),
});
