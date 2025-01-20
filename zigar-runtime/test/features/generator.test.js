import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FINALIZE, YIELD, GENERATOR, THROWING, RETURN } from '../../src/symbols.js';
import { captureError, delay } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: generator', function() {
  describe('createGenerator', async function() {
    it('should return a function that feeds an async generator', async function() {
      const env = new Env();
      const args = {};
      const { ptr, callback } = env.createGenerator(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(() => callback(ptr, 123), 10);
      setTimeout(() => callback(ptr, 456), 20);
      setTimeout(() => callback(ptr, null), 30);
      const result = [];
      for await (const value of args[GENERATOR]) {
        result.push(value);
      }
      expect(result).to.eql([ 123, 456 ]);
    })
    it('should cause generator to throw when callback is given an error', async function() {
      const env = new Env();
      const args = {};
      const { ptr, callback } = env.createGenerator(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(() => callback(ptr, 123), 10);
      setTimeout(() => callback(ptr, 456), 20);
      setTimeout(() => callback(ptr, new Error('Doh!')), 30);
      const result = [];
      let error;
      try {
        for await (const value of args[GENERATOR]) {
          result.push(value);
        }
      } catch (err) {
        error = err;
      }
      expect(result).to.eql([ 123, 456 ]);
      expect(error).to.be.an('error');
    })
    it('should cause generator to throw when error is passed to the return function', async function() {
      const env = new Env();
      const args = {};
      const { ptr, callback } = env.createGenerator(args, undefined);
      args[FINALIZE] = () => {};
      args[RETURN](new Error('Doh!'));
      const result = [];
      let error;
      try {
        for await (const value of args[GENERATOR]) {
          result.push(value);
        }
      } catch (err) {
        error = err;
      }
      expect(result).to.eql([]);
      expect(error).to.be.an('error');
    })

    it('should return false when a break occurs during iteration of generator', async function() {
      const env = new Env();
      const args = {};
      const retvals = [];
      const { ptr, callback } = env.createGenerator(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(() => retvals.push(callback(ptr, 123)), 10);
      setTimeout(() => retvals.push(callback(ptr, 456)), 20);
      for await (const value of args[GENERATOR]) {
        break;
      }
      await delay(50);
      const result = await Promise.all(retvals);
      expect(result).to.eql([ true, false ]);
    })
    it('should return false when the generator\'s throw method is called', async function() {
      const env = new Env();
      const args = {};
      const retvals = [];
      const { ptr, callback } = env.createGenerator(args, undefined);
      args[FINALIZE] = () => {};
      args[GENERATOR].throw(new Error('Duh'));
      setTimeout(() => retvals.push(callback(ptr, 123)), 10);
      setTimeout(() => retvals.push(callback(ptr, 456)), 20);
      for await (const value of args[GENERATOR]) {
      }
      await delay(50);
      const result = await Promise.all(retvals);
      expect(result).to.eql([ false, false ]);
    })
    it('should wait for value to be retrieved', async function() {
      const env = new Env();
      const args = {};
      const { ptr, callback } = env.createGenerator(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(async () => {
        // don't wait on the first item, so the second call would see it before
        // it's pulled off the queue
        callback(ptr, 0);
        for (let i = 1; i < 5; i++) {
          await callback(ptr, i);
        }
        await callback(ptr, null);
      }, 10);
      const result = [];
      for await (const value of args[GENERATOR]) {
        result.push(value);
      }
      expect(result).to.eql([ 0, 1, 2, 3, 4 ]);
    })

    it('should pass item received to given callback function', function() {
      const env = new Env();
      const args = {};
      const result = [];
      const fn = (value) => { result.push(value) };
      args[FINALIZE] = () => {};
      const { ptr, callback } = env.createGenerator(args, fn);
      callback(ptr, 123);
      callback(ptr, 456);
      callback(ptr, null);
      expect(result).to.eql([ 123, 456, null ]);
    })
    it('should pass item received to function accepting two arguments', function() {
      const env = new Env();
      const args = {};
      const result = [];
      const fn = (error, value) => {
        if (!error) {
          result.push(value);
        }
      };
      args[FINALIZE] = () => {};
      const { ptr, callback } = env.createGenerator(args, fn);
      callback(ptr, 123);
      callback(ptr, 456);
      callback(ptr, new Error('Dog'));
      expect(result).to.eql([ 123, 456 ]);
    })
    it('should throw when given a non-function', function() {
      const env = new Env();
      const args = {};
      expect(() => env.createGenerator(args, 'Dingo')).to.throw(TypeError);
    })
  })
  describe('createGeneratorCallback', function() {
    it('should return a callback function', function() {
      const env = new Env();
      let retval;
      const generator = {
        ptr: null,
        callback(ptr, arg) {
          retval = arg;
        },
      };
      const args = {};
      const cb = env.createGeneratorCallback(args, generator);
      expect(cb).to.be.a('function');
      expect(args[YIELD]).to.be.a('function');
      cb(123);
      expect(retval).to.equal(123);
      args[YIELD](456);
      expect(retval).to.equal(456);
    })
    it('should correctly handle two arguments', function() {
      const env = new Env();
      let retval;
      const generator = {
        ptr: null,
        callback(ptr, arg) {
          retval = arg;
        },
      };
      const args = {};
      const cb = env.createGeneratorCallback(args, generator);
      cb(null, 123);
      expect(retval).to.equal(123);
    })
  })
  describe('pipeContents', function() {
    it('should extract contents from async iterator and pass them to callback', async function() {
      const env = new Env();
      const fn = async function*() {
        for (let i = 0; i < 5; i++) {
          yield i;
        }
      };
      const generator = fn();
      const list = [];
      function Args() {
        this[YIELD] = value => list.push(value);
      }
      const args = new Args;
      await env.pipeContents(generator, args);
      expect(list).to.eql([ 0, 1, 2, 3, 4, null ]);
    })
    it('should not pass null to callback', async function() {
      const env = new Env();
      const fn = async function*() {
        for (let i = 0; i < 5; i++) {
          yield (i === 2) ? null : i;
        }
      };
      const generator = fn();
      const list = [];
      function Args() {
        this[YIELD] = value => list.push(value);
      }
      const args = new Args;
      await env.pipeContents(generator, args);
      expect(list).to.eql([ 0, 1, 3, 4, null ]);
    })
    it('should not pass null to callback', async function() {
      const env = new Env();
      const fn = async function*() {
        for (let i = 0; i < 5; i++) {
          yield (i === 2) ? null : i;
        }
      };
      const generator = fn();
      const list = [];
      function Args() {
        this[YIELD] = value => list.push(value);
      }
      const args = new Args;
      await env.pipeContents(generator, args);
      expect(list).to.eql([ 0, 1, 3, 4, null ]);
    })
    it('should send error to console when callback does not accept errors', async function() {
      const env = new Env();
      const fn = async function*() {
        for (let i = 0; i < 5; i++) {
          yield i;
        }
        throw new Error('Doh!');
      };
      const generator = fn();
      const list = [];
      function Args() {
        this[YIELD] = value => list.push(value);
      }
      const args = new Args;
      const [ line ] = await captureError(async () => {
        await env.pipeContents(generator, args);
      });
      expect(list).to.eql([ 0, 1, 2, 3, 4 ]);
      expect(line).to.contain('Doh!');
    })
    it('should pass error to callback when callback accepts errors', async function() {
      const env = new Env();
      const fn = async function*() {
        for (let i = 0; i < 5; i++) {
          yield i;
        }
        throw new Error('Doh!');
      };
      const generator = fn();
      let error;
      const list = [];
      function Args() {
        this[YIELD] = (value) => {
          if (value instanceof Error) {
            error = value;
          } else {
            list.push(value);
          }
        };
      }
      Args[THROWING] = true;
      const args = new Args;
      const [ line ] = await captureError(async () => {
        await env.pipeContents(generator, args);
      });
      expect(list).to.eql([ 0, 1, 2, 3, 4 ]);
      expect(error).to.be.an('error');
      expect(line).to.be.undefined;
    })
    it('should send error to console when callback cannot handle an error', async function() {
      const env = new Env();
      const fn = async function*() {
        for (let i = 0; i < 5; i++) {
          yield i;
        }
        throw new Error('Doh!');
      };
      const generator = fn();
      const list = [];
      function Args() {
        this[YIELD] = (value) => {
          if (value instanceof Error) {
            throw new Error('Donut!');
          } else {
            list.push(value);
          }
        };
      }
      Args[THROWING] = true;
      const args = new Args;
      const [ line ] = await captureError(async () => {
        await env.pipeContents(generator, args);
      });
      expect(list).to.eql([ 0, 1, 2, 3, 4 ]);
      expect(line).to.contain('Donut!');
    })
  })
})
