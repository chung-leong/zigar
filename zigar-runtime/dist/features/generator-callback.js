import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { GENERATOR, CALLBACK, FINALIZE } from '../symbols.js';

var generatorCallback = mixin({
  createGeneratorCallback(args, func) {
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      const generator = args[GENERATOR] = new AsyncGenerator();
      func = generator.push.bind(generator);
    }
    const cb = args[CALLBACK] = (ptr, result) => {
      let cont;
      if (func.length === 2) {
        cont = func(result instanceof Error ? result : null, isError ? null : result);
      } else {
        cont = func(result);
      }
      if (!cont) {
        args[FINALIZE]();
        const id = this.getFunctionId(cb);
        this.releaseFunction(id);
      }
      return cont;
    };
    return cb;
  },
});

class AsyncGenerator {
  objects = [];
  promise = null;
  resolve = null;
  stopped = false;
  finished = false;

  async next() {
    if (this.stopped) {
      return { done: true };
    }
    while (true) {
      if (this.objects.length > 0) {
        return { value: this.objects.shift(), done: false };
      } else if (this.error) {
        throw this.error;
      } else if (this.finished) {
        return { done: true };
      }
      // wait for more content
      await (this.promise ??= new Promise(f => this.resolve = f));
      this.promise = this.resolve = null;
    }
  }

  async return(retval) {
    this.stopped = true;
    return { value: retval, done: true };
  }

  async throw(err) {
    this.stopped = true;
    throw err;
  }

  push(result) {
    if (this.stopped) {
      return false;
    }
    if (result instanceof Error) {
      this.error = result;
      this.finished = true;
    } else if (result === null) {
      this.finished = true;
    } else {
      this.objects.push(result);
    }
    this.resolve?.();
    return !this.finished;
  }

  [Symbol.asyncIterator]() { return this }
}

export { generatorCallback as default };
