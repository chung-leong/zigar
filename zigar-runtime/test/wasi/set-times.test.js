import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: set-times', function() {
    it('should call listener', async function() {
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
      const result1 = f(3, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
      expect(result1).to.equal(0);
      expect(event).to.eql({ path: '/world', times: { atime: 123n, mtime: 456n } });
      const result2 = f(3, pathAddress, pathLen, 123n, 456n, 1 << 0 | 1 << 2);
      expect(result2).to.equal(PosixError.ENOENT);
    })
    it('should use current time when flags call for it', async function() {
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
      const result = f(3, pathAddress, pathLen, 0n, 0n, 1 << 1 | 1 << 3);
      expect(result).to.equal(0);
      expect(event.times.atime).to.be.at.least(10000n);
      expect(event.times.mtime).to.be.at.least(10000n);
    })
    it('should call listener with correct path when a descriptor is used', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return new Uint8Array(32);
      });
      let event;
      env.addListener('set_times', (evt) => {
        if (event) return false;
        event = evt;
        return true;
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(3, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const f = env.getWASIHandler('fd_filestat_set_times');
      const result2 = f(fd, 123n, 456n, 1 << 0 | 1 << 2);
      expect(result2).to.equal(0);
      expect(event).to.eql({ path: '/hello.txt', times: { atime: 123n, mtime: 456n } });
    })
    it('should fail when file descriptor does not have a path', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const fd = 1;
      const f = env.getWASIHandler('fd_filestat_set_times');
      const result = f(fd, 123n, 456n, 1 << 0 | 1 << 2);
      expect(result).to.equal(PosixError.EBADF);
    })
  })
}