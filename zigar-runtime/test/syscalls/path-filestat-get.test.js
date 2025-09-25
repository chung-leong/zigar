import { expect } from 'chai';
import { PosixDescriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-filestat-get', function() {
  it('should call listener', async function() {
    const env = new Env();
    let event;
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
    env.addListener('stat', (evt) => {
      event = evt;
      return { size: 123n };
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const flags = 1;
    const result = env.pathFilestatGet(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
    expect(result).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      path: 'hello.txt', 
      flags: { symlinkFollow: true } 
    });
  })
  it('should use open listener when stat is not available', async function() {
    const env = new Env();
    let event;
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
    env.addListener('open', (evt) => {
      event = evt;
      return new Uint8Array(32);
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const flags = 1;
    const result = env.pathFilestatGet(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
    expect(result).to.equal(0);
    const dv = env.obtainZigView(bufAddress, 64);
    const size = dv.getBigUint64(32, env.littleEndian);
    expect(size).to.equal(32n);
    expect(event).to.eql({
      parent: null,
      path: 'hello.txt',
      rights: {},
      flags: { symlinkFollow: true, dryrun: true }
    });
  })
  it('should display error when open listener returns a value that cannot be converted to a stream', async function() {
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
    env.addListener('open', (evt) => {
      return 'hello';
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const flags = 1;
    let result;
    const [ error ] = await captureError(() => {
      result = env.pathFilestatGet(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
    })
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('appropriate stream interface');
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
    env.addListener('stat', (evt) => false);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const flags = 1;
    const result = env.pathFilestatGet(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
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
    env.addListener('stat', (evt) => undefined);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const flags = 1;
    const result = env.pathFilestatGet(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  it('should display error when listener returns unexpected type', async function() {
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
    env.addListener('stat', (evt) => 'hello');
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const flags = 1;
    let result;
    const [ error ] = await captureError(() => {
      result = env.pathFilestatGet(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
    });
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('object');
  })
  if (process.env.TARGET === 'wasm') {
    it('should call listener use through WASI', async function() {
      const env = new Env();
      let event;
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('stat', (evt) => {
        event = evt;
        return { size: 123n };
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = path.length;
      const bufAddress = 0x2000;
      env.moveExternBytes(path, pathAddress, true);
      const f = env.getWASIHandler('path_filestat_get');
      const flags = 1;
      const result = f(PosixDescriptor.root, flags, pathAddress, pathLen, bufAddress);
      expect(result).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt', 
        flags: { symlinkFollow: true } 
      });
    })
  }
})