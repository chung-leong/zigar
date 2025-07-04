import { RootDescriptor } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidFileDescriptor } from '../errors.js';
import { decodeText, hasMethod } from '../utils.js';

export default mixin({
  init() {
    const w1 = this.createLogWriter(1);
    const w2 = this.createLogWriter(2);
    const root = {
      *readdir() {        
      },
      valueOf() {
        return null;
      }
    };
    this.logWriters = { 1: w1, 2: w2 };
    this.streamMap = new Map([ [ 1, w1 ], [ 2, w2 ], [ RootDescriptor, root ] ]);
    this.flushRequestMap = new Map();
    this.nextStreamHandle = 0xffff;
  },
  getStream(fd, method) {
    const stream = this.streamMap.get(fd);
    if (!stream || (method && !hasMethod(stream, method))) {
      throw new InvalidFileDescriptor();
    }
    return stream;
  },
  createStreamHandle(stream) {
    const fd = this.nextStreamHandle++;
    this.streamMap.set(fd, stream);
    stream.onClose = () => this.closeStream(fd);
    return fd;
  },
  destroyStreamHandle(fd) {
    const stream = this.streamMap.get(fd);
    stream?.destroy?.();
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
      } else if (fd === 3) {
        map.set(RootDescriptor, this.convertDirectory(arg));
      } else {
        throw new Error(`Expecting 0, 1, 2, or 3, received ${fd}`);
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
        env.triggerEvent('log', { handle, message });
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
    imports: {
      flushStdout: {},
    },
    /* c8 ignore next */
  } : undefined),
});
