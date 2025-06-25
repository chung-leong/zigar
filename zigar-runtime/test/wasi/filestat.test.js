import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: filestat', function() {
    it('should call listener', async function() {
      const env = new Env();
      let event;
      env.memory = new WebAssembly.Memory({ initial: 128 });
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
      const result = f(3, flags, pathAddress, pathLen, bufAddress);
      expect(result).to.equal(0);
      expect(event).to.eql({ path: '/hello.txt', flags: { symlinkFollow: true } });
    })
    it('should call listener with correct path when a descriptor is used', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
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
      const result1 = open(3, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_filestat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      expect(event).to.eql({ path: '/hello.txt', flags: {} });
    })
  })
}