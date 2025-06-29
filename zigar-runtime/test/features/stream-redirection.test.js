import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { InvalidFileDescriptor } from '../../src/errors.js';
import '../../src/mixins-wasi.js';
import { capture, delay, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-redirection', function() {
  describe('writeBytes', function() {
    const encoder = new TextEncoder();
    it('should output text to console', async function() {
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
      const address = usize(0x1000);
      const array = encoder.encode('Hello world\n');
      const dv = env.obtainZigView(address, array.length, false);
      for (let i = 0; i < array.length; i++) dv.setUint8(i, array[i]);
      const lines = await capture(() => env.writeBytes(1, address, dv.byteLength));
      expect(lines).to.eql([ 'Hello world' ]);
    })
    it('should allow addition text to be append to current line', async function() {
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
      const address1 = usize(0x1000);
      const array1 = encoder.encode('Hello world!');
      const dv1 = env.obtainZigView(address1, array1.length, false);
      for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
      const address2 = usize(0x2000);
      const array2 = encoder.encode('\n');
      const dv2 = env.obtainZigView(address2, array2.length, false);
      for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
      const lines = await capture(async () => {
        env.writeBytes(2, address1, dv1.byteLength);
        await delay(10);
        env.writeBytes(2, address2, dv2.byteLength);
      });
      expect(lines).to.eql([ 'Hello world!' ]);
      env.flushStreams();
    })
    it('should eventually output text not ending with newline', async function() {
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
      const address1 = usize(0x1000);
      const array1 = encoder.encode('Hi!\nHello world');
      const dv1 = env.obtainZigView(address1, array1.length, false);
      for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
      const address2 = usize(0x2000);
      const array2 = encoder.encode('!');
      const dv2 = env.obtainZigView(address2, array2.length, false);
      for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
      const lines = await capture(async () => {
        env.writeBytes(1, address1, dv1.byteLength);
        await delay(10);
        env.writeBytes(1, address2, dv2.byteLength);
        await delay(300);
      });
      expect(lines).to.eql([ 'Hi!', 'Hello world!' ]);
    })
  })
  describe('readBytes', function() {
    it('should read data from Uint8Array', async function() {
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
      const count1 = env.readBytes(0, address, dv.byteLength);
      expect(count1).to.equal(4);
      expect(dv.getUint8(0)).to.equal(0);
      expect(dv.getUint8(3)).to.equal(3);
      const count2 = env.readBytes(0, address, dv.byteLength);
      expect(count2).to.equal(4);
      expect(dv.getUint8(0)).to.equal(4);
      expect(dv.getUint8(3)).to.equal(7);
      const count3 = env.readBytes(0, address, dv.byteLength);
      expect(count3).to.equal(2);
      expect(dv.getUint8(0)).to.equal(8);
    })
  })
  describe('closeStream', function() {
    it('should close a stream', async function() {
      const env = new Env();
      const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      env.redirectStream(0, array);
      env.closeStream(0);
      expect(() => env.getStreamPointer(0)).to.throw();
    })
  })
  describe('redirectStream', function() {
    it('should redirect stdout to an array', async function() {
      const env = new Env();
      const chunks = [];
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
      const original = env.redirectStream(1, chunks);
      const address = usize(0x1000);
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world\n');
      const dv = env.obtainZigView(address, array.length, false);
      for (let i = 0; i < array.length; i++) dv.setUint8(i, array[i]);
      env.writeBytes(1, address, dv.byteLength);
      expect(chunks).to.have.lengthOf(1);
      expect(chunks[0]).to.eql(array);
      env.redirectStream(1, original);
      const [ line ] = await capture(() => {
        env.writeBytes(1, address, dv.byteLength);
      });
      expect(line).to.equal('Hello world');
    })
    it('should redirect stdout to null', async function() {
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
      env.redirectStream(1, null);
      const address = usize(0x1000);
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world\n');
      const dv = env.obtainZigView(address, array.length, false);
      for (let i = 0; i < array.length; i++) dv.setUint8(i, array[i]);
      const lines = await capture(() => env.writeBytes(1, address, dv.byteLength));
      expect(lines).to.have.lengthOf(0);
    })
    it('should redirect root dir to a map', async function() {
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
      const map = new Map;
      env.redirectStream(3, map);
    })
    it('should close a stream when undefined is given', function() {
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
      env.redirectStream(1, null);
      const address = usize(0x1000);
      env.redirectStream(1, undefined);
      expect(() => env.writeBytes(1, address, 4)).to.throw(InvalidFileDescriptor);
    })
    it('should throw when handle is not 0, 1, or 2', async function() {
      const env = new Env();
      expect(() => env.redirectStream(4, null)).to.throw();
    })
  })
  describe('createStreamHandle', function() {
    it('should create a handle from a reader', async function() {
      const env = new Env();
      const stream = new ReadableStream({
        async pull(controller) {
          controller.close();
        }
      });
      const reader = stream.getReader();
      const handle = env.createStreamHandle(reader, 'read');
      expect(handle).to.be.a('number');
      env.closeStream(handle);
    })
    it('should create a handle from a writer', async function() {
      const env = new Env();
      const stream = new WritableStream({
        async write() {}
      });
      const writer = stream.getWriter();
      const handle = env.createStreamHandle(writer, 'write');
      expect(handle).to.be.a('number');
      env.closeStream(handle);
    })
    it('should create a handle from null', async function() {
      const env = new Env();
      const handle = env.createStreamHandle(null, 'write');
      expect(handle).to.be.a('number');
      env.closeStream(handle);
    })
    it('should throw when invalid input is given', async function() {
      const env = new Env();
      expect(() => env.createStreamHandle(1234, 'read')).to.throw(TypeError);
    })
  })
  describe('flushStreams', function() {
    const encoder = new TextEncoder();
    it('should force pending text to immediately get sent to console', async function() {
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
      const address1 = usize(0x1000);
      const array1 = encoder.encode('Hello world');
      const dv1 = env.obtainZigView(address1, array1.length, false);
      for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
      const address2 = usize(0x2000);
      const array2 = encoder.encode('!');
      const dv2 = env.obtainZigView(address2, array2.length, false);
      for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
      const lines = await capture(async () => {
        env.writeBytes(1, address1, dv1.byteLength);
        await delay(10);
        env.writeBytes(1, address2, dv2.byteLength);
        env.flushStreams();
      });
      expect(lines).to.eql([ 'Hello world!' ]);
    })
    it('should trigger flushing of stdout in C', async function() {
      const env = new Env();
      let called = false;
      env.libc = true;
      env.flushStdout = () => called = true;
      env.flushStreams();
      expect(called).to.be.true;
    })
  })
})

