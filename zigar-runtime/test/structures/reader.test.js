import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: reader', function() {
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
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
        env.moveExternBytes = function(jsDV, address, to) {
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const { context, readFn } = env.createReader(reader);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const bufferAddress1 = usize(0x1000);
      const dv1 = env.obtainZigView(bufferAddress1, 4);
      const buffer1 = {
        '*': { [MEMORY]: dv1 }
      }
      const read1 = await readFn(ptr, buffer1);
      expect(read1).to.equal(4);
      const bufferAddress2 = usize(0x2000);
      const dv2 = env.obtainZigView(bufferAddress2, 40);
      const buffer2 = {
        '*': { [MEMORY]: dv2 }
      }
      const read2 = await readFn(ptr, buffer2);
      expect(read2).to.equal(4);
      const read3 = await readFn(ptr, buffer2);
      expect(read3).to.equal(8);
    })
    it('should create a read struct from an instanceof ReadableStreamBYOBReader', async function() {
      const env = new Env();
      let count = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          const { byobRequest } = controller;
          if (count++ < 4) {
            const { view } = byobRequest;
            for (let i = 0; i < view.length; i++) {
              view[i] = 123;
            }
            byobRequest.respond(view.length);
          } else {
            controller.close();
            byobRequest.respond(0);
          }
        },
        type: 'bytes',
      });
      const reader = stream.getReader({ mode: 'byob' });
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
        env.moveExternBytes = function(jsDV, address, to) {
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const { context, readFn } = env.createReader(reader);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const bufferAddress1 = usize(0x1000);
      const dv1 = env.obtainZigView(bufferAddress1, 4);
      const buffer1 = {
        '*': { [MEMORY]: dv1 }
      }
      const read1 = await readFn(ptr, buffer1);
      expect(read1).to.equal(4);
      const bufferAddress2 = usize(0x2000);
      const dv2 = env.obtainZigView(bufferAddress2, 40);
      const buffer2 = {
        '*': { [MEMORY]: dv2 }
      }
      const read2 = await readFn(ptr, buffer2);
      expect(read2).to.equal(40);
    })
    it('should create a reader struct from a Blob', async function() {
      const env = new Env();
      const blob = new Blob([
        new Uint8Array([ 0, 1, 2, 3 ]),
        new Uint8Array([ 4, 5, 6, 7, 8 ]),
      ])
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
        env.moveExternBytes = function(jsDV, address, to) {
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const { context, readFn } = env.createReader(blob);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const bufferAddress1 = usize(0x1000);
      const dv1 = env.obtainZigView(bufferAddress1, 4);
      const buffer1 = {
        '*': { [MEMORY]: dv1 }
      }
      const read1 = await readFn(ptr, buffer1);
      expect(read1).to.equal(4);
      const bufferAddress2 = usize(0x2000);
      const dv2 = env.obtainZigView(bufferAddress2, 40);
      const buffer2 = {
        '*': { [MEMORY]: dv2 }
      }
      const read2 = await readFn(ptr, buffer2);
      expect(read2).to.equal(5);
      const read3 = await readFn(ptr, buffer2);
      expect(read3).to.equal(0);
    })
    it('should create a read struct from a Uint8Array', async function() {
      const env = new Env();
      const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8 ]);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
        env.moveExternBytes = function(jsDV, address, to) {
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const { context, readFn } = env.createReader(array);
      const ptr = {
        '*': { [MEMORY]: context }
      };
      const bufferAddress1 = usize(0x1000);
      const dv1 = env.obtainZigView(bufferAddress1, 4);
      const buffer1 = {
        '*': { [MEMORY]: dv1 }
      }
      const read1 = readFn(ptr, buffer1);
      expect(read1).to.equal(4);
      const bufferAddress2 = usize(0x2000);
      const dv2 = env.obtainZigView(bufferAddress2, 40);
      const buffer2 = {
        '*': { [MEMORY]: dv2 }
      }
      const read2 = readFn(ptr, buffer2);
      expect(read2).to.equal(5);
      const read3 = readFn(ptr, buffer2);
      expect(read3).to.equal(0);
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
      const [ error ] = await captureError(async () => {
        await expect(readFn(ptr, buffer)).to.eventually.be.rejected;
      });
    })
    it('should rethrow the error when the stream throws one synchronously', async function() {
      const env = new Env();
      const reader = {
        read() {
          throw new Error('doh!');
        }
      };
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
      const [ error ] = await captureError(() => {
        expect(() => readFn(ptr, buffer)).to.throw();
      });
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
      expect(() => env.createReader(undefined)).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
      expect(() => env.createReader(5)).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
      expect(() => env.createReader()).to.throw(TypeError)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
    })
  })
})
