import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { empty } from '../utils.js';
import { NullStream } from './conversion-reader.js';

export default mixin({
  convertWriter(arg) {
    if (arg instanceof WritableStreamDefaultWriter) {
      return new WebStreamWriter(arg);
    } else if (Array.isArray(arg)) {
      return new ArrayWriter(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (typeof(arg?.write) === 'function') {
      return arg;
    } else {
      throw new TypeMismatch('WritableStreamDefaultWriter, array, null, or object with writer interface', arg);
    }
  },
});

class WebStreamWriter {
  onClose = null;
  done = false;

  constructor(writer) {
    this.writer = writer;
    writer.closed.catch(empty).then(() => {
      this.done = true;
      this.onClose?.();
    });
  }

  async write(bytes) {
    await this.writer.write(bytes);
  }

  destroy() {
    if (!this.done) {
      this.writer.close();
    }
  }
}

class ArrayWriter {
  constructor(array) {
    this.array = array;
    this.closeCB = null;
    array.close = () => this.onClose?.();
  }

  write(bytes) {
    this.array.push(bytes);
  }
}
