import { expect } from 'chai';
import { PosixError } from '../../dist/constants.js';
import { PosixDescriptor } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, decodeText, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-readlink', function() {
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
    const target = '/world.txt';
    env.addListener('readlink', (evt) => {
      if (event) return false;
      event = evt;
      return target;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufferAddress = usize(0x2000);
    const bufferLen = 1024;
    const writtenAddress = usize(0x3000);
    env.moveExternBytes(path, pathAddress, true);
    const result1 = env.pathReadlink(PosixDescriptor.root, pathAddress, pathLen, bufferAddress, bufferLen, writtenAddress);
    expect(result1).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      path: 'hello.txt' 
    });
    const writtenDV = env.obtainZigView(writtenAddress, 4, false);
    const written = writtenDV.getUint32(0, env.littleEndian);
    expect(written).to.equal(target.length);
    const bufferDV = env.obtainZigView(bufferAddress, written, false);
    const array = new Uint8Array(bufferDV.buffer, bufferDV.byteOffset, bufferDV.byteLength);
    expect(decodeText(array)).to.equal(target);
    const result2 = env.pathReadlink(PosixDescriptor.root, pathAddress, pathLen, bufferAddress, bufferLen, writtenAddress);
    expect(result2).to.equal(PosixError.ENOENT);
  })
  it('should display error when listener does not return a string', async function() {
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
    env.addListener('readlink', () => 1234);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufferAddress = usize(0x2000);
    const bufferLen = 1024;
    const writtenAddress = usize(0x3000);
    env.moveExternBytes(path, pathAddress, true);
    let result 
    const [ error ] = await captureError(() => {
      result = env.pathReadlink(PosixDescriptor.root, pathAddress, pathLen, bufferAddress, bufferLen, writtenAddress);
    });
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('string');
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
    env.addListener('readlink', () => undefined);
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const bufferAddress = usize(0x2000);
    const bufferLen = 1024;
    const writtenAddress = usize(0x3000);
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathReadlink(PosixDescriptor.root, pathAddress, pathLen, bufferAddress, bufferLen, writtenAddress);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event;
      env.addListener('readlink', (evt) => {
        if (event) return false;
        event = evt;
        return '/world.txt';
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = usize(0x1000);
      const pathLen = path.length;
      const bufferAddress = usize(0x2000);
      const bufferLen = 1024;
      const writtenAddress = usize(0x3000);
      env.moveExternBytes(path, pathAddress, true);
      const f = env.getWASIHandler('path_readlink');
      const result1 = env.pathReadlink(PosixDescriptor.root, pathAddress, pathLen, bufferAddress, bufferLen, writtenAddress);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt' 
      });
      const result2 = f(PosixDescriptor.root, pathAddress, pathLen, bufferAddress, bufferLen, writtenAddress);
      expect(result2).to.equal(PosixError.ENOENT);
    })
  }
})
