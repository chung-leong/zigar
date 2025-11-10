import { expect } from 'chai';
import { PosixDescriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-rename', function() {
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
      env.setRedirectionMask = () => {};
    }
    let event;
    env.addListener('rename', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const newPath = new TextEncoder().encode('/world.txt');
    const newPathAddress = usize(0x2000);
    const newPathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    env.moveExternBytes(newPath, newPathAddress, true);
    const result1 = env.pathRename(PosixDescriptor.root, pathAddress, pathLen, PosixDescriptor.root, newPathAddress, newPathLen);
    expect(result1).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      path: 'hello.txt',
      newParent: null,
      newPath: 'world.txt',
    });
    const result2 = env.pathRename(PosixDescriptor.root, pathAddress, pathLen, PosixDescriptor.root, newPathAddress, newPathLen);
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
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setRedirectionMask = () => {};
    }
    env.addListener('rename', () => 'hello');
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const newPath = new TextEncoder().encode('/world.txt');
    const newPathAddress = usize(0x2000);
    const newPathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    env.moveExternBytes(newPath, newPathAddress, true);
    let result 
    const [ error ] = await captureError(() => {
      result = env.pathRename(PosixDescriptor.root, pathAddress, pathLen, PosixDescriptor.root, newPathAddress, newPathLen);
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
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setRedirectionMask = () => {};
    }
    env.addListener('unlink', () => undefined);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const newPath = new TextEncoder().encode('/world.txt');
    const newPathAddress = usize(0x2000);
    const newPathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    env.moveExternBytes(newPath, newPathAddress, true);
    const result = env.pathRename(PosixDescriptor.root, pathAddress, pathLen, PosixDescriptor.root, newPathAddress, newPathLen);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event;
      env.addListener('rename', (evt) => {
        if (event) return false;
        event = evt;
        return true;
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = usize(0x1000);
      const pathLen = path.length;
      const newPath = new TextEncoder().encode('/world.txt');
      const newPathAddress = usize(0x2000);
      const newPathLen = path.length;
      env.moveExternBytes(path, pathAddress, true);
      env.moveExternBytes(newPath, newPathAddress, true);
      const f = env.getWASIHandler('path_rename');
      const result1 = f(PosixDescriptor.root, pathAddress, pathLen, PosixDescriptor.root, newPathAddress, newPathLen);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt',
        newParent: null,
        newPath: 'world.txt',
      });
      const result2 = f(PosixDescriptor.root, pathAddress, pathLen, PosixDescriptor.root, newPathAddress, newPathLen);
      expect(result2).to.equal(PosixError.ENOENT);
    })
  }
})
