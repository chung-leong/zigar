import { expect } from 'chai';
import { Descriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

const Right = {
  read: 1n << 1n,
  write: 1n << 6n,
};

const OpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};

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
    const result = env.pathOpen(Descriptor.root, 0, pathAddress, pathLen, OpenFlag.exclusive, Right.read, 0n, 0, fdAddress);
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
    const result = env.pathOpen(Descriptor.root, 0, pathAddress, pathLen, OpenFlag.exclusive, Right.write, 0n, 0, fdAddress);
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
    env.addListener('open', (evt) => false);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathOpen(Descriptor.root, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
    expect(result).to.equal(PosixError.ENOENT);
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
      const result = f(Descriptor.root, 0, pathAddress, pathLen, OpenFlag.exclusive, Right.read, 0n, 0, fdAddress);
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
