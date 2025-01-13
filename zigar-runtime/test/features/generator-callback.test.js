import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FINALIZE, GENERATOR } from '../../src/symbols.js';
import { delay } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: generator-callback', function() {
  describe('createGeneratorCallback', async function() {
    it('should return a function that feeds an async generator', async function() {
      const env = new Env();
      const args = {};
      const callback = env.createGeneratorCallback(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(() => callback(null, 123), 10);
      setTimeout(() => callback(null, 456), 20);
      setTimeout(() => callback(null, null), 30);
      const result = [];
      for await (const value of args[GENERATOR]) {
        result.push(value);
      }
      expect(result).to.eql([ 123, 456 ]);
    })
    it('should cause generator to throw when callback is given an error', async function() {
      const env = new Env();
      const args = {};
      const callback = env.createGeneratorCallback(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(() => callback(null, 123), 10);
      setTimeout(() => callback(null, 456), 20);
      setTimeout(() => callback(null, new Error('Doh!')), 30);
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
    it('should return false when a break occurs during iteration of generator', async function() {
      const env = new Env();
      const args = {};
      const retvals = [];
      const callback = env.createGeneratorCallback(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(() => retvals.push(callback(null, 123)), 10);
      setTimeout(() => retvals.push(callback(null, 456)), 20);
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
      const callback = env.createGeneratorCallback(args, undefined);
      args[FINALIZE] = () => {};
      args[GENERATOR].throw(new Error('Duh'));
      setTimeout(() => retvals.push(callback(null, 123)), 10);
      setTimeout(() => retvals.push(callback(null, 456)), 20);
      for await (const value of args[GENERATOR]) {
      }
      await delay(50);
      const result = await Promise.all(retvals);
      expect(result).to.eql([ false, false ]);
    })
    it('should wait for value to be retrieved', async function() {
      const env = new Env();
      const args = {};
      const callback = env.createGeneratorCallback(args, undefined);
      args[FINALIZE] = () => {};
      expect(args[GENERATOR]).to.be.an('object');
      setTimeout(async () => {
        // don't wait on the first item, so the second call would see it before
        // it's pulled off the queue
        callback(null, 0);
        for (let i = 1; i < 5; i++) {
          await callback(null, i);
        }
        await callback(null, null);
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
      const callback = env.createGeneratorCallback(args, fn);
      callback(null, 123);
      callback(null, 456);
      callback(null, null);
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
      const callback = env.createGeneratorCallback(args, fn);
      callback(null, 123);
      callback(null, 456);
      callback(null, new Error('Dog'));
      expect(result).to.eql([ 123, 456 ]);
    })
    it('should throw when given a non-function', function() {
      const env = new Env();
      const args = {};
      expect(() => env.createGeneratorCallback(args, 'Dingo')).to.throw(TypeError);
    })
  })
})
