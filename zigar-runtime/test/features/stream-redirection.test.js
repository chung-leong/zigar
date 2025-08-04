import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize, usizeByteSize } from '../../src/utils.js';
import { capture, captureError, delay } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-redirection', function() {
  describe('destroyStreamHandle', function() {
    it('should remove a stream handle', async function() {
      const env = new Env();
      const stream = {
        read() {},
      };
      env.redirectStream(0, stream);
      env.destroyStreamHandle(0);
      expect(() => env.getStream(0)).to.throw();
    })
    it('should invoke destroy method', async function() {
      const env = new Env();
      let called = false;
      const stream = {
        read() {},
        destroy() {
          called = true;
        },
      };
      env.redirectStream(0, stream);
      env.destroyStreamHandle(0);
      expect(called).to.be.true;
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
      const original = env.redirectStream(1, chunks);
      const bufferAddress = usize(0x1000);
      const stringAddress = usize(0x2000);
      const writtenAddress = usize(0x3000);
      const text = 'Hello world\n';
      const string = new TextEncoder().encode(text);
      const stringDV = env.obtainZigView(stringAddress, string.length)
      for (let i = 0; i < string.length; i++) {
        stringDV.setUint8(i, string[i]);
      }
      const iovsDV = env.obtainZigView(bufferAddress, usizeByteSize * 2, false);
      const stringLen = usize(string.length);
      const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
      const le = env.littleEndian;
      set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
      set.call(iovsDV, usizeByteSize * 1, stringLen, le);
      env.fdWrite(1, bufferAddress, 1, writtenAddress);
      expect(chunks).to.have.lengthOf(1);
      expect(chunks[0]).to.eql(string);
      env.redirectStream(1, original);
      const [ line ] = await capture(() => {
        env.fdWrite(1, bufferAddress, 1, writtenAddress);
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
      env.redirectStream(1, null);
      const bufferAddress = usize(0x1000);
      const stringAddress = usize(0x2000);
      const writtenAddress = usize(0x3000);
      const text = 'Hello world\n';
      const string = new TextEncoder().encode(text);
      const stringDV = env.obtainZigView(stringAddress, string.length)
      for (let i = 0; i < string.length; i++) {
        stringDV.setUint8(i, string[i]);
      }
      const iovsDV = env.obtainZigView(bufferAddress, usizeByteSize * 2, false);
      const stringLen = usize(string.length);
      const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
      const le = env.littleEndian;
      set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
      set.call(iovsDV, usizeByteSize * 1, stringLen, le);
      const lines = await capture(() => env.fdWrite(1, bufferAddress, 1, writtenAddress));
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
    it('should close a stream when undefined is given', async function() {
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
      env.redirectStream(1, null);
      const bufferAddress = usize(0x1000);
      const writtenAddress = usize(0x3000);
      env.redirectStream(1, undefined);
      let result;
      await captureError(() => {
        result = env.fdWrite(1, bufferAddress, 1, writtenAddress);
      });
      expect(result).to.equal(PosixError.EBADF);
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
      const file = env.convertReader(reader);
      const handle = env.createStreamHandle(file);
      expect(handle).to.be.a('number');
      env.destroyStreamHandle(handle);
    })
    it('should create a handle from a writer', async function() {
      const env = new Env();
      const stream = new WritableStream({
        async write() {}
      });
      const writer = stream.getWriter();
      const file = env.convertWriter(writer);
      const handle = env.createStreamHandle(file);
      expect(handle).to.be.a('number');
      env.destroyStreamHandle(handle);
    })
    it('should create a handle from null', async function() {
      const env = new Env();
      const file = env.convertWriter(null);
      const handle = env.createStreamHandle(file);
      expect(handle).to.be.a('number');
      env.destroyStreamHandle(handle);
    })
  })
  describe('destroyStreamHandle', function() {
    
  })
  describe('flushStreams', function() {
    const encoder = new TextEncoder();
    it('should force pending text to immediately get sent to console', async function() {
      const env = new Env();
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
      const bufferAddress = usize(0x1000);
      const stringAddress = usize(0x2000);
      const writtenAddress = usize(0x3000);
      const text = 'Hello world';
      const string = new TextEncoder().encode(text);
      const stringDV = env.obtainZigView(stringAddress, string.length)
      for (let i = 0; i < string.length; i++) {
        stringDV.setUint8(i, string[i]);
      }
      const iovsDV = env.obtainZigView(bufferAddress, usizeByteSize * 2, false);
      const stringLen = usize(string.length);
      const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
      const le = env.littleEndian;
      const lines = await capture(async () => {
        set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
        set.call(iovsDV, usizeByteSize * 1, stringLen, le);
        env.fdWrite(1, bufferAddress, 1, writtenAddress);
        await delay(10);
        stringDV.setUint8(0, '!'.charCodeAt(0));
        set.call(iovsDV, usizeByteSize * 1, usize(1), le);
        env.fdWrite(1, bufferAddress, 1, writtenAddress);
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

