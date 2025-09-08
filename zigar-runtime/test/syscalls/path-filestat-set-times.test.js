import { expect } from 'chai';
import { PosixDescriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-filestat-set-times', function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('set_times', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const path = new TextEncoder().encode('/world');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result1 = env.pathFilestatSetTimes(PosixDescriptor.root, 0, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result1).to.equal(0);
    expect(event).to.eql({ 
      flags: {},
      parent: null,
      path: 'world', 
      times: { atime: 123n, mtime: 456n } 
    });
    const result2 = env.pathFilestatSetTimes(PosixDescriptor.root, 0, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result2).to.equal(PosixError.ENOENT);
  })
  it('should use current time when flags call for it', async function() {
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
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('set_times', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathFilestatSetTimes(PosixDescriptor.root, 0, pathAddress, pathLen, 0n, 0n, 1 << 1 | 1 << 3);
    expect(result).to.equal(0);
    expect(event.times.atime).to.be.at.least(10000n);
    expect(event.times.mtime).to.be.at.least(10000n);
  })
  it('should display error when listener does not return a boolean', async function() {
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
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('set_times', (evt) => 'hello');
    const path = new TextEncoder().encode('/world');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    let result;
    const [ error ] = await captureError(() => {
      result = env.pathFilestatSetTimes(PosixDescriptor.root, 0, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
    });
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('boolean');
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }   
    let event;
    env.addListener('set_times', (evt) => undefined);
    const path = new TextEncoder().encode('/world');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathFilestatSetTimes(PosixDescriptor.root, 0, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event;
      env.addListener('set_times', (evt) => {
        if (event) return false;
        event = evt;
        return true;
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/world');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_filestat_set_times');
      const result1 = f(PosixDescriptor.root, 0, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        flags: {},
        parent: null,
        path: 'world', 
        times: { atime: 123n, mtime: 456n } 
      });
      const result2 = f(PosixDescriptor.root, 0, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
      expect(result2).to.equal(PosixError.ENOENT);
    })
  }
})