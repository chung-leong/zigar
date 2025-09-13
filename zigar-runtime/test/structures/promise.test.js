import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FINALIZE, MEMORY, PROMISE, RETURN, TRANSFORM, ZIG } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Structure: promise', function() {
  describe('createPromise', function() {
    it('should return a function that fulfills a promise attached to the argument struct', async function() {
      const env = new Env();
      const args = {};
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      const { ptr, callback } = env.createPromise(structure, args, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      args[FINALIZE] = () => {};
      callback(ptr, 123);
      const result = await args[PROMISE];
      expect(result).to.equal(123);
    })
    it('should return a function that fulfills a promise with a string', async function() {
      const env = new Env();
      const args = {};
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      const { ptr, callback } = env.createPromise(structure, args, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      args[FINALIZE] = () => {};
      args[TRANSFORM] = (retval) => retval.string;
      callback(ptr, { string: 'Hello' });
      const result = await args[PROMISE];
      expect(result).to.equal('Hello');
    })

    it('should create copy of the result when it uses Zig memory', async function() {
      const env = new Env();
      const args = {};
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      const { ptr, callback } = env.createPromise(structure, args, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      args[FINALIZE] = () => {};
      const copy = env.getCopyFunction();
      const Result = function(other) {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        if (other) {
          copy(this[MEMORY], other[MEMORY]);
        }
      };
      const resultFixed = new Result();
      resultFixed[MEMORY].setInt32(0, 1234);
      resultFixed[MEMORY][ZIG] = { address: usize(0x1000), len: 4 };
      callback({ '*': { [MEMORY]: ptr } }, resultFixed);
      const result = await args[PROMISE];
      expect(result[MEMORY]).to.not.equal(resultFixed[MEMORY]);
      expect(result[MEMORY][ZIG]).to.be.undefined;
    })
    it('should reject a promise when the callback function is given an error', async function() {
      const env = new Env();
      const args = {};
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      const { ptr, callback } = env.createPromise(structure, args, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      let error;
      args[FINALIZE] = () => {};
      callback(ptr, new Error('Doh!'));
      try {
        await args[PROMISE];
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
    })
    it('should return a function that calls the given callback', function() {
      const env = new Env();
      const args1 = {};
      let result;
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      const promise1 = env.createPromise(structure, args1, arg => result = arg);
      expect(args1[PROMISE]).to.be.undefined;
      args1[FINALIZE] = () => {};
      promise1.callback(promise1.ptr, 123);
      expect(result).to.equal(123);
      const args2 = {};
      const promise2 = env.createPromise(structure, args2, arg => result = arg);
      args2[FINALIZE] = () => {};
      args2[RETURN](456);
      expect(result).to.equal(456);
    })
    it('should correctly handle callback with two arguments', function() {
      const env = new Env();
      let error, result;
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      const args1 = {};
      const promise1 = env.createPromise(structure, args1, (err, value) => {
        error = err;
        result = value;
      });
      args1[FINALIZE] = () => {};
      expect(args1[PROMISE]).to.be.undefined;
      promise1.callback(promise1.ptr, 123);      
      expect(result).to.equal(123);
      expect(error).to.be.null;
      const args2 = {};
      const promise2 = env.createPromise(structure, args2, (err, value) => {
        error = err;
        result = value;
      });
      args2[FINALIZE] = () => {};
      promise2.callback(promise2.ptr, new Error('Doh!'));
      expect(result).to.be.null;
      expect(error).to.be.an('error');
      const args3 = {};
      const promise3 = env.createPromise(structure, args3, (err, value) => {
        error = err;
        result = value;
      });
      args3[FINALIZE] = () => {};
      args3[RETURN](456);
      expect(result).to.equal(456);
      expect(error).to.be.null;
    })
    it('should throw when given a non-function', function() {
      const env = new Env();
      const args = {};
      const structure = {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      expect(() => env.createPromise(structure, args, 'Dingo')).to.throw(TypeError);
    })
  })
  describe('createPromiseCallback', function() {
    it('should return a callback function', function() {
      const env = new Env();
      let retval;
      const promise = {
        ptr: null,
        callback: {
          '*': function(ptr, arg) {
            retval = arg;
          },
        },
      };
      const args = {};
      const cb = env.createPromiseCallback(args, promise);
      expect(cb).to.be.a('function');
      expect(args[RETURN]).to.be.a('function');
      cb(123);
      expect(retval).to.equal(123);
      args[RETURN](456);
      expect(retval).to.equal(456);
    })
    it('should correctly handle two arguments', function() {
      const env = new Env();
      let retval;
      const promise = {
        ptr: null,
        callback: {
          '*': function(ptr, arg) {
            retval = arg;
          },
        },
      };
      const args = {};
      const cb = env.createPromiseCallback(args, promise);
      cb(null, 123);
      expect(retval).to.equal(123);
    })
  })
})
