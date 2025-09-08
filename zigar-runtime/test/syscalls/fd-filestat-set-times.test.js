import { expect } from 'chai';
import { PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-filestat-set-times', function() {
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
    const array = new Uint8Array(32);
    env.addListener('open', () => {
      return array;
    });
    let event;
    env.addListener('set_times', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result1 = env.pathOpen(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, true);
    const result2 = env.fdFilestatSetTimes(fd, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result2).to.equal(0);
    expect(event).to.eql({
      parent: null,
      target: array,
      path: 'hello.txt',
      flags: {},
      times: { atime: 123n, mtime: 456n } 
    });
  })
  it('should call listener even when file descriptor does not have a path', async function() {
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
    const array = new Uint8Array(32);
    const file = env.convertReader(array);
    const fd = env.createStreamHandle(file, [ PosixDescriptorRight.fd_filestat_set_times, 0 ]);
    const result = env.fdFilestatSetTimes(fd, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result).to.equal(PosixError.NONE);
    expect(event).to.eql({
      flags: {},
      target: array,
      times: { atime: 123n, mtime: 456n } 
    });
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
    const array = new Uint8Array(32);
    env.addListener('open', () => {
      return array;
    });
    env.addListener('set_times', (evt) => 'hello');
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    env.pathOpen(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, true);
    let result;
    const [ error ] = await captureError(() => {
      result = env.fdFilestatSetTimes(fd, 123n, 456n, 1 << 0 | 1 << 2);
    })   
    expect(result).to.equal(PosixError.EBADF);
    expect(error).to.contain('boolean');
  })
  it('should return ENOTCAPABLE when listener returns undefined', async function() {
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
    const array = new Uint8Array(32);
    env.addListener('open', () => {
      return array;
    });
    env.addListener('set_times', (evt) => undefined);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    env.pathOpen(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, true);
    const result = env.fdFilestatSetTimes(fd, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result).to.equal(PosixError.ENOTCAPABLE);
  })
})