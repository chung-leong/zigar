import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { MEMORY } from '../../src/symbols.js';
import { delay } from '../test-utils.js';

use(ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: writer', function() {
  describe('createWriter', function() {
    it('should create a writer struct from an instanceof WritableStreamDefaultWriter', async function() {
      const env = new Env();
      const chunks = [];
      const stream = new WritableStream({
        async write(chunk) {
          chunks.push(chunk);
        }
      });
      const writer = stream.getWriter();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, writeFn } = env.createWriter(writer);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const dv = new DataView(new ArrayBuffer(8));
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i);
      }
      const buffer = {
        '*': { [MEMORY]: dv }
      }
      const written = await writeFn(ptr, buffer);
      expect(written).to.equal(8);
      await writer.close();
      expect(chunks).to.have.lengthOf(1);
      expect(chunks[0]).to.have.lengthOf(8);
      expect([ ...chunks[0] ]).to.eql([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      expect(chunks[0].buffer).to.not.equal(dv.buffer);
      await delay(0);
      const writtenAfter = await writeFn(ptr, buffer);
      expect(writtenAfter).to.equal(0);
    })
    it('should create a writer struct from an array', async function() {
      const env = new Env();
      const chunks = [];
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, writeFn } = env.createWriter(chunks);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const dv = new DataView(new ArrayBuffer(8));
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i);
      }
      const buffer = {
        '*': { [MEMORY]: dv }
      }
      const written = writeFn(ptr, buffer);
      expect(written).to.equal(8);
      expect(chunks).to.have.lengthOf(1);
      expect(chunks[0]).to.have.lengthOf(8);
      expect([ ...chunks[0] ]).to.eql([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      expect(chunks[0].buffer).to.not.equal(dv.buffer);
    })
    it('should fail after a series of small writes', async function() {
      const env = new Env();
      const chunks = [];
      const stream = new WritableStream({
        async write(chunk) {
          chunks.push(chunk);
        }
      });
      const writer = stream.getWriter();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, writeFn } = env.createWriter(writer);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const dv = new DataView(new ArrayBuffer(1));
      const buffer = {
        '*': { [MEMORY]: dv }
      }
      let error;
      try {
        for (let i = 0; i < 200; i++) {
          await writeFn(ptr, buffer);
        }
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error').with.property('message').that.contains('BufferedWriter');
    })
    it('should rethrow the error when the stream throws one', async function() {
      const env = new Env();
      const stream = new WritableStream({
        async write(chunk) {
          throw new Error('doh!');
        }
      });
      const writer = stream.getWriter();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const { context, writeFn } = env.createWriter(writer);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const dv = new DataView(new ArrayBuffer(8));
      const buffer = {
        '*': { [MEMORY]: dv }
      }
      await expect(writeFn(ptr, buffer)).to.eventually.be.rejected;
    })
    it('should return an object if it has the properties of a writer', async function() {
      const env = new Env();
      const writer = {
        context: {},
        writeFn: {},
      };
      expect(() => env.createWriter(writer)).to.not.throw();
    })
    it('should throw when given an unrecognized object', async function() {
      const env = new Env();
      expect(() => env.createWriter({})).to.throw(TypeError)
        .with.property('message').that.contains('WritableStreamDefaultWriter');
      expect(() => env.createWriter(undefined)).to.throw(TypeError)
        .with.property('message').that.contains('WritableStreamDefaultWriter');
      expect(() => env.createWriter(5)).to.throw(TypeError)
        .with.property('message').that.contains('WritableStreamDefaultWriter');
      expect(() => env.createWriter()).to.throw(TypeError)
        .with.property('message').that.contains('WritableStreamDefaultWriter');
    })
  })
})
