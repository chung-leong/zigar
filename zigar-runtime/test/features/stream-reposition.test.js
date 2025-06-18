import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { IllegalSeek } from '../../src/errors.js';
import '../../src/mixins.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-redirection', function() {
  describe('changeStreamPointer', function() {
    it('should change the position of an array reader', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = (address, len) => {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
      }
      const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      env.redirectStream(0, array);
      const address = usize(0x1000);
      const dv = env.obtainZigView(address, 4, false);
      const pos = env.changeStreamPointer(0, -1, 2);
      expect(pos).to.equal(9);
      const count = env.readBytes(0, address, dv.byteLength);
      expect(count).to.equal(1);
      expect(dv.getUint8(0)).to.equal(9);
    })
    it('should throw when reader is not seekable', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = (address, len) => {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
      }
      const stream = new ReadableStream({
        async pull(controller) {
          controller.close();
        }
      });
      const reader = stream.getReader();
      env.redirectStream(0, reader);
      expect(() => env.changeStreamPointer(0, -1, 2)).to.throw(IllegalSeek);
    })
  })
  describe('getStreamPointer', function() {
    it('should return the position of an array reader', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = (address, len) => {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
      }
      const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      env.redirectStream(0, array);
      const address = usize(0x1000);
      const dv = env.obtainZigView(address, 4, false);
      env.readBytes(0, address, dv.byteLength);
      const pos = env.getStreamPointer(0);
      expect(pos).to.equal(4);
    })
    it('should throw when reader is not seekable', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = (address, len) => {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
      }
      const stream = new ReadableStream({
        async pull(controller) {
          controller.close();
        }
      });
      const reader = stream.getReader();
      env.redirectStream(0, reader);
      expect(() => env.getStreamPointer(0)).to.throw(IllegalSeek);
    })
  })
})
