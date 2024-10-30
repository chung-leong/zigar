import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { CONTEXT, FINALIZE, FIXED, MEMORY, PROMISE } from '../../src/symbols.js';
import { CallContext } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: promise-callback', function() {
  describe('createCallback', function() {
    it('should return a function that fulfills a promise attached to the argument struct', async function() {
      const env = new Env();
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const callback = env.createCallback(args, null, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      args[FINALIZE] = () => {};
      callback(123);
      const result = await args[PROMISE];
      expect(result).to.equal(123);
    })
    it('should create copy of the result when it uses fixed memory', async function() {
      const env = new Env();
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const callback = env.createCallback(args, null, undefined);
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
      resultFixed[MEMORY][FIXED] = { address: usize(0x1000), len: 4 };
      callback(resultFixed);
      const result = await args[PROMISE];
      expect(result[MEMORY]).to.not.equal(resultFixed[MEMORY]);
      expect(result[MEMORY][FIXED]).to.be.undefined;
    })
    it('should reject a promise when the callback function is given an error', async function() {
      const env = new Env();
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const callback = env.createCallback(args, null, undefined);
      expect(args[PROMISE]).to.be.a('promise');
      let error;
      args[FINALIZE] = () => {};
      callback(new Error('Doh!'));
      try {
        await args[PROMISE];
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
    })
    it('should return a function that calls the given callback', function() {
      const env = new Env();
      const args = {
        [CONTEXT]: new CallContext(),
      };
      let result;
      const callback = env.createCallback(args, null, arg => result = arg);
      expect(args[PROMISE]).to.be.undefined;
      args[FINALIZE] = () => {};
      callback(123);
      expect(result).to.equal(123);
    })
  })
})
