import { expect } from 'chai';
import { PosixDescriptor, PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { InvalidFileDescriptor, TooManyFiles, Unsupported } from '../../src/errors.js';
import '../../src/mixins.js';
import { copyView, usize, usizeByteSize } from '../../src/utils.js';
import { capture, captureError, delay } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-redirection', function() {
  describe('getStream', function() {
    it('should retrieve a stream', function() {
      const env = new Env();
      const stdout = env.getStream(1);
      expect(stdout).to.be.an('array');
    })
    it('should throw an InvalidFileDescriptor error when no stream is found', function() {
      const env = new Env();
      expect(() => env.getStream(PosixDescriptor.min + 5)).to.throw(InvalidFileDescriptor);
    })
    it('should throw an Unsupported error when descriptor is outside the range of private descriptors', function() {
      const env = new Env();
      expect(() => env.getStream(10)).to.throw(Unsupported);
    })
    if (process.env.TARGET === 'wasm') {
      it('should return the root stream when the descriptor is 3', function() {
        const env = new Env();
        const root = env.getStream(3);
        expect(root).to.be.an('array');
      })
    }
  })
  describe('destroyStreamHandle', function() {
    it('should remove a stream handle', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const stream = {
        read() {},
      };
      env.redirectStream(0, stream);
      env.destroyStreamHandle(0);
      expect(() => env.getStream(0)).to.throw();
    })
    it('should invoke destroy method', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
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
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const stream = env.convertWriter(chunks);
      const original = env.redirectStream(1, stream);
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
      const [ line ] = await capture(async () => {
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
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
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
      env.redirectStream(-1, map);
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
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
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
    it('should throw when argument cannot be converted to a stream', async function() {
      const env = new Env();
      expect(() => env.redirectStream(1, 'dingo')).to.throw();
    })
  })
  describe('createStreamHandle', function() {
    it('should create a handle from a reader', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const stream = new ReadableStream({
        async pull(controller) {
          controller.close();
        }
      });
      const reader = stream.getReader();
      const file = env.convertReader(reader);
      const handle = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
      expect(handle).to.be.a('number');
      env.destroyStreamHandle(handle);
    })
    it('should create a handle from a writer', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const stream = new WritableStream({
        async write() {}
      });
      const writer = stream.getWriter();
      const file = env.convertWriter(writer);
      const handle = env.createStreamHandle(file, [ PosixDescriptorRight.fd_write, 0 ]);
      expect(handle).to.be.a('number');
      env.destroyStreamHandle(handle);
    })
    it('should create a handle from null', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const file = env.convertWriter(null);
      const handle = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
      expect(handle).to.be.a('number');
      env.destroyStreamHandle(handle);
    })
    it('should throw when there are too many files', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const { max } = PosixDescriptor;
      PosixDescriptor.max = PosixDescriptor.min + 100;
      try {
        const file = env.convertWriter(null);
        expect(() => {
          while (true) {
            env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
          }
        }).to.throw(TooManyFiles);        
      } finally {
        PosixDescriptor.max = max;
      }
    })
    it('should reuse file descriptors once the full range is used', async function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const { max } = PosixDescriptor;
      PosixDescriptor.max = PosixDescriptor.min + 100;
      try {
        const file = env.convertWriter(null);
        expect(() => {
          for (let count = 0; count < 200; count++) {
            const fd = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
            env.destroyStreamHandle(fd);
          }
        }).to.not.throw();
      } finally {
        PosixDescriptor.max = max;
      }
    })
    it('should throw an error when redirection is disabled', async function() {
      const env = new Env();
      env.ioRedirection = false;
      const file = env.convertWriter(null);
      expect(() => {
        env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
      }).to.throw();
    })
    if (process.env.TARGET === 'node') {
      it('should activate syscall trap', async function() {
        const env = new Env();
        let syscallTrap;
        env.setSyscallTrap = (on) => {
          syscallTrap = on;
        };
        const stream = new ReadableStream({
          async pull(controller) {
            controller.close();
          }
        });
        const reader = stream.getReader();
        const file = env.convertReader(reader);
        const handle = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
        expect(syscallTrap).to.be.true;
        env.destroyStreamHandle(handle);
        expect(syscallTrap).to.be.false;
      })
    }
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
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
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
  })
})

