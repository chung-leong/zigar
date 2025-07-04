import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError, RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-filestat-get', function() {
  it('should call listener with correct path', async function() {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    const array = new Uint8Array(32);
    env.addListener('open', () => {
      return array;
    });
    let event;
    env.addListener('stat', (evt) => {
      event = evt;
      return { size: 123n };
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const fdAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(RootDescriptor, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const dv = new DataView(env.memory.buffer);
    const fd = dv.getUint32(fdAddress, true);
    const bufAddress = 0x3000;
    const result2 = env.fdFilestatGet(fd, bufAddress);
    expect(result2).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      target: array,
      path: 'hello.txt', 
      flags: {} 
    });
    const size = dv.getBigUint64(bufAddress + 32, true);
    expect(size).to.equal(123n);
  })
  it('should use size of array when there is no listener', async function() {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    env.addListener('open', () => {
      return new Uint8Array(32);
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const fdAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const dv = new DataView(env.memory.buffer);
    const fd = dv.getUint32(fdAddress, true);
    const bufAddress = 0x3000;
    const result2 = env.fdFilestatGet(fd, bufAddress);
    expect(result2).to.equal(0);
    const size = dv.getBigUint64(bufAddress + 32, true);
    expect(size).to.equal(32n);
  })
  it('should rethrow error when listener throws', async function() {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    env.addListener('open', () => {
      return new Uint8Array(32);
    });
    env.addListener('stat', () => {
      throw new Error('Doh!');
    })
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const fdAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const dv = new DataView(env.memory.buffer);
    const fd = dv.getUint32(fdAddress, true);
    const bufAddress = 0x3000;
    let result2;
    const [ error ] = await captureError(() => {
      result2 = env.fdFilestatGet(fd, bufAddress);
    });
    expect(result2).to.equal(PosixError.EBADF);
    expect(error).to.contain('Doh!');
  })
  it('should set size to zero when there is no information', async function() {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    const fd = 1;
    const bufAddress = 0x3000;
    const dv = new DataView(env.memory.buffer);
    const result2 = env.fdFilestatGet(fd, bufAddress);
    expect(result2).to.equal(0);
    const size = dv.getBigUint64(bufAddress + 32, true);
    expect(size).to.equal(0n);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const array = new Uint8Array(32);;
      env.addListener('open', () => {
        return array;
      });
      let event;
      env.addListener('stat', (evt) => {
        event = evt;
        return { size: 123n };
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(RootDescriptor, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_filestat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        target: array,
        path: 'hello.txt', 
        flags: {} 
      });
      const size = dv.getBigUint64(bufAddress + 32, true);
      expect(size).to.equal(123n);
    })
  }
})