import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { YIELD, THROWING, GENERATOR, MEMORY, STRING_RETVAL, FINALIZE, RETURN } from '../symbols.js';
import { usize } from '../utils.js';

var generator = mixin({
  init() {
    this.generatorCallbackMap = new Map();
    this.generatorInstanceMap = new Map();
    this.nextGeneratorInstanceId = usize(0x2000);
  },
  createGenerator(structure, args, func) {
    const { constructor } = structure;
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      const generator = args[GENERATOR] = new AsyncGenerator();
      func = generator.push.bind(generator);
    }
    // create a handle referencing the function 
    const instanceId = this.nextGeneratorInstanceId++;
    const ptr = this.obtainZigView(instanceId, 0, false);
    this.generatorInstanceMap.set(instanceId, { func, args });
    // use the same callback for all generators of a given type
    let callback = this.generatorCallbackMap.get(constructor);
    if (!callback) {
      callback = async (ptr, result) => {
        // the function assigned to args[RETURN] down below calls this function
        // with a DataView instead of an actual pointer
        const dv = (ptr instanceof DataView) ? ptr : ptr['*'][MEMORY];
        const instanceId = this.getViewAddress(dv);
        const instance = this.generatorInstanceMap.get(instanceId);
        if (instance) {
          const { func, args } = instance;
          const isError = result instanceof Error;
          if (!isError && args[STRING_RETVAL] && result) {
            result = result.string;
          }
          const retval = await ((func.length === 2)
          ? func(isError ? result : null, isError ? null : result)
          : func(result));
          if (retval === false || isError || result === null) {
            args[FINALIZE]();
            this.generatorInstanceMap.delete(instanceId);
            return false;
          } else {
            return true;
          }
        }
      };
      this.generatorCallbackMap.set(constructor, callback);
      this.destructors.push(() => this.freeFunction(callback));
    }
    args[RETURN] = result => callback(ptr, result);
    return { ptr, callback };
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
    await this.break();
    return { value: retval, done: true };
  }

  async throw(error) {
    await this.break();
    throw error;
  }

  async break() {
    if (!this.finished) {
      this.stopped = true;
      // wait for a push() to ensure that the Zig side has stopped generating
      await this.sleep('break');
    }
  }

  async push(result) {
    if (this.stopped) {
      this.wake('break');
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
      {
        // on the WebAssembly side we the main thread can't wait for worker threads
        // so we don't have this problem
        promise.resolve();
      }
    }
  }

  [Symbol.asyncIterator]() { return this }
}

export { generator as default };
