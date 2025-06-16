import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';

export default mixin({
  convertWriter(arg) {
    if (arg instanceof WritableStreamDefaultWriter) {
      return new WebStreamWriter(arg);
    } else if (Array.isArray(arg)) {
      return new ArrayWriter(arg);
    } else if (arg === globalThis.console) {
      return this.console;
    } else if (arg === null) {
      return new NullWriter();
    } else if (typeof(arg?.write) === 'function') {
      return arg;
    } else {
      throw new TypeMismatch('WritableStreamDefaultWriter, array, console, null, or object with writer interface', arg);
    }
  },
});

class WebStreamWriter {
  constructor(writer) {
    this.writer = writer;
  }

  async write(bytes) {
    await this.writer.write(bytes);
  }

  set onClose(cb) {
    this.writer.closed.then(cb, cb);
  }
}

class ArrayWriter {
  constructor(array) {
    this.array = array;
    this.closeCB = null;
  }

  write(bytes) {
    this.array.push(bytes);
  }

  close() {
    this.onClose?.();
  }
}

class NullWriter {
  write() {}

  close() {}
}
