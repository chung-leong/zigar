import { expect } from 'chai';
import { PosixDescriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-unlink-file', function() {
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
      env.setRedirectionMask = () => {};
    }
    let event;
    env.addListener('unlink', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result1 = env.pathUnlinkFile(PosixDescriptor.root, pathAddress, pathLen);
    expect(result1).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      path: 'hello.txt' 
    });
    const result2 = env.pathUnlinkFile(PosixDescriptor.root, pathAddress, pathLen);
    expect(result2).to.equal(PosixError.ENOENT);
  })
  it('should display error when listener does not return a boolean', async function() {
    const env = new Env();
    env.memory = new WebAssembly.Memory({ initial: 1 });
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
      env.setRedirectionMask = () => {};
    }
    env.addListener('unlink', () => 'hello');
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    let result 
    const [ error ] = await captureError(() => {
      result = env.pathUnlinkFile(PosixDescriptor.root, pathAddress, pathLen);
    });
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('boolean');
  })
  it('should return return ENOTSUP when listener returns undefined', async function() {
    const env = new Env();
    env.memory = new WebAssembly.Memory({ initial: 1 });
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
      env.setRedirectionMask = () => {};
    }
    env.addListener('unlink', () => undefined);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathUnlinkFile(PosixDescriptor.root, pathAddress, pathLen);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event;
      env.addListener('unlink', (evt) => {
        if (event) return false;
        event = evt;
        return true;
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = usize(0x1000);
      const pathLen = path.length;
      env.moveExternBytes(path, pathAddress, true);
      const f = env.getWASIHandler('path_unlink_file');
      const result1 = f(PosixDescriptor.root, pathAddress, pathLen);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt' 
      });
      const result2 = f(PosixDescriptor.root, pathAddress, pathLen);
      expect(result2).to.equal(PosixError.ENOENT);
    })
  }
})
