import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FINALIZE, MEMORY, PROMISE, ZIG } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: promise-callback', function() {
  describe('createPromiseCallback', function() {
    it('should return a function that fulfills a promise attached to the argument struct', async function() {
      const env = new Env();
      const args = {};
      const callback = env.createPromiseCallback(args, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      args[FINALIZE] = () => {};
      callback(null, 123);
      const result = await args[PROMISE];
      expect(result).to.equal(123);
    })
    it('should create copy of the result when it uses Zig memory', async function() {
      const env = new Env();
      const args = {};
      const callback = env.createPromiseCallback(args, undefined);
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
      callback(null, resultFixed);
      const result = await args[PROMISE];
      expect(result[MEMORY]).to.not.equal(resultFixed[MEMORY]);
      expect(result[MEMORY][ZIG]).to.be.undefined;
    })
    it('should reject a promise when the callback function is given an error', async function() {
      const env = new Env();
      const args = {};
      const callback = env.createPromiseCallback(args, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      let error;
      args[FINALIZE] = () => {};
      callback(null, new Error('Doh!'));
      try {
        await args[PROMISE];
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
    })
    it('should return a function that calls the given callback', function() {
      const env = new Env();
      const args = {};
      let result;
      const callback = env.createPromiseCallback(args, arg => result = arg);
      expect(args[PROMISE]).to.be.undefined;
      args[FINALIZE] = () => {};
      callback(null, 123);
      expect(result).to.equal(123);
    })
    it('should correctly handle callback with two arguments', function() {
      const env = new Env();
      const args = {};
      let error, result;
      const callback = env.createPromiseCallback(args, (err, value) => {
        error = err;
        result = value;
      });
      expect(args[PROMISE]).to.be.undefined;
      args[FINALIZE] = () => {};
      callback(null, 123);
      expect(result).to.equal(123);
      expect(error).to.be.null;
      callback(null, new Error('Doh!'));
      expect(result).to.be.null;
      expect(error).to.be.an('error');
    })
    it('should throw when given a non-function', function() {
      const env = new Env();
      const args = {};
      expect(() => env.createPromiseCallback(args, 'Dingo')).to.throw(TypeError);
    })
  })
})
