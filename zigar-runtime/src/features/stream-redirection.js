import { CallResult } from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText, isPromise } from '../utils.js';

export default mixin({
  init() {
    this.nextStreamHandle = 0x10000;
    const c = this.console = new ConsoleWriter();
    this.streamMap = new Map([ [ 1, c ], [ 2, c ] ]);
  },
  writeBytes(fd, address, len) {
    const dv = this.obtainZigView(address, len, false);
    const writer = this.streamMap.get(fd)
    if (dv && writer) {
      try {
        const result = writer.write(dv);
        if(isPromise(result)) {
          return result.then(() => CallResult.OK, () => CallResult.Failure);
        } 
        return CallResult.OK;
      } catch (err) {
        console.error(err);
      }
    }
    return CallResult.Failure;
  },
  readBytes(fd, address, len) {
    const dv = this.obtainZigView(address, len, false);
    const reader = this.streamMap.get(fd)
    if (dv && reader) {
      try {
        const result = writer.write(dv);
        if(isPromise(result)) {
          return result.then(() => CallResult.OK, () => CallResult.Failure);
        } 
        return CallResult.OK;
      } catch {
        console.error(err);
      }
    }
    return CallResult.Failure;
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
