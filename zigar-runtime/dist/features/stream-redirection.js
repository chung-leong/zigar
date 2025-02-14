import '../constants.js';
import { mixin } from '../environment.js';
import { decodeText } from '../utils.js';

var streamRedirection = mixin({
  init() {
    this.consoleObject = null;
    this.consolePending = [];
    this.consoleTimeout = 0;
  },
  writeToConsole(dv) {
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
        this.writeToConsoleNow([ ...this.consolePending, beginning ]);
        this.consolePending.splice(0);
        if (remaining.length > 0) {
          this.consolePending.push(remaining);
        }
      }
      clearTimeout(this.consoleTimeout);
      this.consoleTimeout = 0;
      if (this.consolePending.length > 0) {
        this.consoleTimeout = setTimeout(() => {
          this.writeToConsoleNow(this.consolePending);
          this.consolePending.splice(0);
        }, 250);
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  },
  writeToConsoleNow(array) {
    const c = this.consoleObject ?? globalThis.console;
    c.log?.call?.(c, decodeText(array));
  },
  flushConsole() {
    if (this.consolePending.length > 0) {
      this.writeToConsoleNow(this.consolePending);
      this.consolePending.splice(0);
      clearTimeout(this.consoleTimeout);
    }
  },
  ...({
    imports: {
      flushStdout: { argType: '', returnType: '' },
    },
  } ),
});

export { streamRedirection as default };
