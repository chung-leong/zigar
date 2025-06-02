import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Feature: reader', function() {
  describe('createReader', function() {
    it('should create a read struct from an instanceof ReadableStreamDefaultReader', async function() {
      const env = new Env();
      let count = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          if (count++ < 4) {
            controller.enqueue(new Uint8Array(8));
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, readFn } = env.createReader(reader);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const buffer1 = {
        '*': { [MEMORY]: new DataView(new ArrayBuffer(4)) }
      }
      const read1 = await readFn(ptr, buffer1);
      expect(read1).to.equal(4);
      const buffer2 = {
        '*': { [MEMORY]: new DataView(new ArrayBuffer(40)) }
      }
      const read2 = await readFn(ptr, buffer2);
      expect(read2).to.equal(28);
      const read3 = await readFn(ptr, buffer2);
      expect(read3).to.equal(0);
    })
    it('should create a read struct from an instanceof ReadableStreamBYOBReader', async function() {
      const env = new Env();
      let count = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          if (count++ < 4) {
            const { byobRequest } = controller;
            const { view } = byobRequest;
            for (let i = 0; i < view.length; i++) {
              view[i] = 123;
            }
            byobRequest.respond(view.length);
          } else {
            controller.close();
          }
        },
        type: 'bytes',
      });
      const reader = stream.getReader({ mode: 'byob' });
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, readFn } = env.createReader(reader);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const buffer1 = {
        '*': { [MEMORY]: new DataView(new ArrayBuffer(4)) }
      }
      const read1 = await readFn(ptr, buffer1);
      expect(read1).to.equal(4);
      const buffer2 = {
        '*': { [MEMORY]: new DataView(new ArrayBuffer(40)) }
      }
      const read2 = await readFn(ptr, buffer2);
      expect(read2).to.equal(40);
    })
    it('should rethrow the error when the stream throws one', async function() {
      const env = new Env();
      const stream = new ReadableStream({
        async pull(controller) {
          throw new Error('doh!');
        }
      });
      const reader = stream.getReader();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, readFn } = env.createReader(reader);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const dv = new DataView(new ArrayBuffer(8));
      const buffer = {
        '*': { [MEMORY]: dv }
      }
      await expect(readFn(ptr, buffer)).to.eventually.be.rejected;
    })
    it('should return an object if it has the properties of a reader', async function() {
      const env = new Env();
      const reader = {
        context: {},
        readFn: {},
      };
      expect(() => env.createReader(reader)).to.not.throw();
    })
    it('should throw when given an unrecognized object', async function() {
      const env = new Env();
      expect(() => env.createReader({})).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
      expect(() => env.createReader(null)).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
      expect(() => env.createReader(5)).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
      expect(() => env.createReader()).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
    })
  })
})
