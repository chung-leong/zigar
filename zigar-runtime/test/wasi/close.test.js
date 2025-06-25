import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: close', function() {
    it('should close previously opened stream', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      let event;
      env.addListener('open', (evt) => {
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
      const result1 = open(3, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const f = env.getWASIHandler('fd_close');
      const result2 = f(fd); 
      expect(result2).to.equal(0);
    })
  })
}