import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: open', function() {
    it('should call listener', async function() {
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
      const f = env.getWASIHandler('path_open');
      const result = f(3, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
      expect(result).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      expect(fd).to.not.equal(0);
    })
  })
}