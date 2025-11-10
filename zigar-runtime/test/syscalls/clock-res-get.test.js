import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: clock-res-get', function() {
  if (process.env.TARGET === 'wasm') {
    it('should return resolution of clock', function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('clock_res_get');
      expect(f(0, 0x1000)).to.equal(0);
      const dv = new DataView(env.memory.buffer, 0x1000, 8);
      const res = dv.getBigUint64(0, env.littleEndian);
      expect(res).to.be.above(0n);
    })
  }
})
