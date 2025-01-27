import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { GENERATOR, RETURN, YIELD, THROWING, FINALIZE } from '../symbols.js';

var generator = mixin({
  createGenerator(args, func) {
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      const generator = args[GENERATOR] = new AsyncGenerator();
      func = generator.push.bind(generator);
    }
    const callback = async (ptr, result) => {
      const isError = result instanceof Error;
      const retval = await ((func.length === 2)
      ? func(isError ? result : null, isError ? null : result)
      : func(result));
      if (retval === false || isError || result === null) {
        args[FINALIZE]();
        const id = this.getFunctionId(callback);
        this.releaseFunction(id);
        return false;
      } else {
        return true;
      }
    };
    args[RETURN] = result => callback(null, result);
    return { ptr: null, callback };
  },
  createGeneratorCallback(args, generator) {
    const { ptr, callback } = generator;
    const f = callback['*'];
    args[YIELD] = result => f.call(args, ptr, result);
    return (...argList) => {
      const result = (argList.length === 2) ? argList[0] ?? argList[1] : argList[0];
      return args[YIELD](result);
    };
  },
  async pipeContents(generator, args) {
    try {
      try {
        const iter = generator[Symbol.asyncIterator]();
        for await (const elem of iter) {
          if (elem !== null) {
            if (!args[YIELD](elem)) {
              break;
            }
          }
        }
        args[YIELD](null);
      } catch (err) {
        if (args.constructor[THROWING]) {
          args[YIELD](err);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(err);
    }
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
    const promise = this.promises[name] ||= new Promise(f => resolve = f);
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

export { generator as default };
