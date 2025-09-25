import { expect } from 'chai';
import { PosixDescriptor, PosixDescriptorRight, PosixError, PosixOpenFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-open', function() {
  it('should call listener', async function() {
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
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('open', (evt) => {
      event = evt;
      return new Uint8Array(32);
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, PosixOpenFlag.exclusive, PosixDescriptorRight.fd_read, 0n, 0, fdAddress);
    expect(result).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    expect(fd).to.not.equal(0);
    expect(event).to.eql({
      parent: null,
      path: 'hello.txt',
      rights: { read: true },
      flags: { exclusive: true }
    });
  })
  it('should default rights to fd_read when zero', async function() {
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
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('open', (evt) => {
      event = evt;
      return new Uint8Array(32);
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, PosixOpenFlag.exclusive, 0n, 0n, 0, fdAddress);
    expect(result).to.equal(0);    
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    expect(fd).to.not.equal(0);
    expect(event).to.eql({
      parent: null,
      path: 'hello.txt',
      rights: { read: true },
      flags: { exclusive: true }
    });
  })
  it('should handle writable resource returned by listener', async function() {
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
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('open', (evt) => {
      event = evt;
      return [];
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, PosixOpenFlag.exclusive, PosixDescriptorRight.fd_write, 0n, 0, fdAddress);
    expect(result).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    expect(fd).to.not.equal(0);
    expect(event).to.eql({
      parent: null,
      path: 'hello.txt',
      rights: { write: true },
      flags: { exclusive: true }
    });
  })
  it('should return ENOENT when listener returns false', async function() {
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
      env.setRedirectionMask = () => {};
    }   
    env.addListener('open', (evt) => false);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
    expect(result).to.equal(PosixError.ENOENT);
  })
  it('should return ENOTSUP when listener returns undefined', async function() {
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
      env.setRedirectionMask = () => {};
    }   
    env.addListener('open', (evt) => undefined);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  it('should display error when listener returns a value that cannot be converted to a stream', async function() {
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
      env.setRedirectionMask = () => {};
    }   
    env.addListener('open', (evt) => 'hello');
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    let result;
    const [ error ] = await captureError(() => {
      result = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
    })
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('appropriate stream interface');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event;
      env.addListener('open', (evt) => {
        event = evt;
        return new Uint8Array(32);
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = path.length;
      const fdAddress = 0x2000;
      env.moveExternBytes(path, pathAddress, pathLen);
      const f = env.getWASIHandler('path_open');
      const result = f(PosixDescriptor.root, 0, pathAddress, pathLen, PosixOpenFlag.exclusive, PosixDescriptorRight.fd_read, 0n, 0, fdAddress);
      expect(result).to.equal(0);
      const fdDV = env.obtainZigView(fdAddress, 4);
      const fd = fdDV.getUint32(0, env.littleEndian);
      expect(fd).to.not.equal(0);
      expect(event).to.eql({
        parent: null,
        path: 'hello.txt',
        rights: { read: true },
        flags: { exclusive: true }
      });
    })
  }
})
