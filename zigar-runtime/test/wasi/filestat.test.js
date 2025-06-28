import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { captureError, RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: filestat', function() {
    it('should call listener', async function() {
      const env = new Env();
      let event;
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('stat', (evt) => {
        event = evt;
        return { size: 123n };
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const bufAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_filestat_get');
      const flags = 1;
      const result = f(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
      expect(result).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt', 
        flags: { symlinkFollow: true } 
      });
    })
    it('should return ENOENT when listener returns false', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('stat', (evt) => false);
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const bufAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_filestat_get');
      const flags = 1;
      const result = f(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
      expect(result).to.equal(PosixError.ENOENT);
    })
    it('should display error when listener returns unexpected type', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('stat', (evt) => undefined);
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const bufAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_filestat_get');
      const flags = 1;
      let result;
      const [ error ] = await captureError(() => {
        result = f(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
      });
      expect(result).to.equal(PosixError.ENOENT);
      expect(error).to.contain('object');
    })
    it('should call listener with correct path when a descriptor is used', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return new Uint8Array(32);
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
        path: 'hello.txt', 
        flags: {} 
      });
      const size = dv.getBigUint64(bufAddress + 32, true);
      expect(size).to.equal(123n);
    })
    it('should use size of array when there is no listener', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
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
      const open = env.getWASIHandler('path_open');
      const result1 = open(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_filestat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      const size = dv.getBigUint64(bufAddress + 32, true);
      expect(size).to.equal(32n);
    })
    it('should rethrow error when listener throws', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
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
      const open = env.getWASIHandler('path_open');
      const result1 = open(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_filestat_get');
      let result2;
      const [ error ] = await captureError(() => {
        result2 = f(fd, bufAddress);
      });
      expect(result2).to.equal(PosixError.EBADF);
      expect(error).to.contain('Doh!');
    })
    it('should set size to zero when there is no information', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const fd = 1;
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_filestat_get');
      const dv = new DataView(env.memory.buffer);
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      const size = dv.getBigUint64(bufAddress + 32, true);
      expect(size).to.equal(0n);
    })
  })
}