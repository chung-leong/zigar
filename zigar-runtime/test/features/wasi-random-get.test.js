import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: wasi-random-get', function() {
    it('should provide a function that writes random bytes at memory location', function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      const f = env.getWASIHandler('random_get');
      expect(f(0x1000, 16)).to.equal(0);
      const dv = new DataView(env.memory.buffer, 0x1000, 16);
      let sum = 0;
      for (let i = 0; i < dv.byteLength; i++) {
        sum += dv.getUint8(i);
      }
      expect(sum).to.not.equal(PosixError.NONE);
    })
  })
}
