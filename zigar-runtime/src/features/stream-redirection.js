import { mixin } from '../environment.js';
import { decodeText } from '../utils.js';

export default mixin({
  console: globalThis.console,
  consolePending: [],
  consoleTimeout: 0,

  writeToConsole(dv) {
    const { console } = this;
    try {
      // make copy of array, in case incoming buffer is pointing to stack memory
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.subarray(index + 1);
        const list = [ ...this.consolePending, beginning ];
        console.log(decodeText(list));
        this.consolePending.splice(0);
        if (remaining.length > 0) {
          this.consolePending.push(remaining);
        }
      }
      clearTimeout(this.consoleTimeout);
      this.consoleTimeout = 0;
      if (this.consolePending.length > 0) {
        this.consoleTimeout = setTimeout(() => {
          console.log(decodeText(this.consolePending));
          this.consolePending.splice(0);
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  },
  flushConsole() {
    if (this.consolePending.length > 0) {
      console.log(decodeText(this.consolePending));
      this.consolePending.splice(0);
      clearTimeout(this.consoleTimeout);
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      flushStdout: { argType: '', returnType: '' },
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      flushStdout: null,
    },
  } : undefined),
});
