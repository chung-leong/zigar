import { expect } from 'chai';
import { PosixDescriptor, PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-fdstat-get', function() {
  it('should provide information about stdout', async function() {
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
    const bufAddress = usize(0x1000);
    const result = env.fdFdstatGet(1, bufAddress);
    expect(result).to.equal(0);
    const fdstatDV = env.obtainZigView(bufAddress, 24);
    const rights = Number(fdstatDV.getBigUint64(8, env.littleEndian));
    expect(rights & PosixDescriptorRight.fd_write).to.not.equal(0);
  })
  it('should obtain information from a file descriptor', async function() {
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
    env.addListener('open', () => {
      return new Uint8Array(32);
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = src.length;
    const fdAddress = usize(0x2000);
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, BigInt(PosixDescriptorRight.fd_read), 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    const bufAddress = usize(0x3000);
    const result2 = env.fdFdstatGet(fd, bufAddress);
    expect(result2).to.equal(0);
    const fdstatDV = env.obtainZigView(bufAddress, 24);
    const rights = Number(fdstatDV.getBigUint64(8, env.littleEndian));
    expect(rights & PosixDescriptorRight.fd_read).to.not.equal(0);
  })
  it('should obtain information from a directory descriptor', async function() {
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
    env.addListener('open', () => {
      return new Map();
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = src.length;
    const fdAddress = usize(0x2000);
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, BigInt(PosixDescriptorRight.fd_readdir), 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    const bufAddress = usize(0x3000);
    const result2 = env.fdFdstatGet(fd, bufAddress);
    expect(result2).to.equal(0);
    const fdstatDV = env.obtainZigView(bufAddress, 24);
    const rights = Number(fdstatDV.getBigUint64(8, env.littleEndian));
    expect(rights & PosixDescriptorRight.fd_readdir).to.not.equal(0);
  })
  it('should use stream type', async function() {
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
    env.addListener('open', () => {
      return {
        type: 'directory',
        readdir() {}
      };
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = src.length;
    const fdAddress = usize(0x2000);
    const pathDV = env.obtainZigView(pathAddress, pathLen, false);
    const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, BigInt(PosixDescriptorRight.fd_readdir), 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    const bufAddress = usize(0x3000);
    const result2 = env.fdFdstatGet(fd, bufAddress);
    expect(result2).to.equal(0);
    const fdstatDV = env.obtainZigView(bufAddress, 24);
    const rights = Number(fdstatDV.getBigUint64(8, env.littleEndian));
    expect(rights & PosixDescriptorRight.fd_readdir).to.not.equal(0);
  })
  it('should return EINVAL if stream type is incorrect', async function() {
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
    env.addListener('open', () => {
      return {
        type: 'dir',
        readdir() {}
      };
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = src.length;
    const fdAddress = usize(0x2000);
    const pathDV = env.obtainZigView(pathAddress, pathLen, false);
    const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const result1 = env.pathOpen(PosixDescriptor.root, 0, pathAddress, pathLen, 0, BigInt(PosixDescriptorRight.fd_readdir), 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    const bufAddress = usize(0x3000);
    let result2;
    const [ error ] = await captureError(() => {
      result2 = env.fdFdstatGet(fd, bufAddress);
    })
    expect(result2).to.equal(PosixError.EINVAL);
    expect(error).to.contain('dir');
  })
})
