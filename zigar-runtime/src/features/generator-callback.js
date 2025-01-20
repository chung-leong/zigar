import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { FINALIZE, GENERATOR, RETURN } from '../symbols.js';

export default mixin({
  createGeneratorCallback(args, func) {
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      const generator = args[GENERATOR] = new AsyncGenerator();
      func = generator.push.bind(generator);
    }
    const cb = (ptr, result) => {
      let cont;
      if (func.length === 2) {
        const isError = result instanceof Error;
        cont = func(isError ? result : null, isError ? null : result);
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
    args[RETURN] = result => cb(null, result);
    return cb;
  },
});

class AsyncGenerator {
  result = null;
  stopped = false;
  finished = false;
  promises = {};

  async next() {
    if (this.stopped) {
      return { done: true };
    }
    while (true) {
      const value = this.result;
      if (value !== null) {
        this.result = null;
        this.wake('space');
        return { value, done: false };
      } else if (this.error) {
        throw this.error;
      } else if (this.finished) {
        return { done: true };
      }
      // wait for more content
      await this.sleep('content');
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

  async push(result) {
    if (this.stopped) {
      return false;
    }
    if (result instanceof Error) {
      this.error = result;
      this.finished = true;
    } else if (result === null) {
      this.finished = true;
    } else {
      if (this.result !== null) {
        await this.sleep('space');
      }
      this.result = result;
    }
    this.wake('content');
    return !this.finished;
  }

  sleep(name) {
    let resolve;
    const promise = this.promises[name] ??= new Promise(f => resolve = f);
    if (resolve) promise.resolve = resolve;
    return promise;
  }

  wake(name) {
    const promise = this.promises[name];
    if (promise) {
      this.promises[name] = null;
      promise.resolve();
    }
  }

  [Symbol.asyncIterator]() { return this }
}