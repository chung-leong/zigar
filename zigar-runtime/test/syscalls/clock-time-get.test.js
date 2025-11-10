import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: clock-time-get', function() {
  if (process.env.TARGET === 'wasm') {
    it('should return current time', function() {
      const now1 = Date.now();
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('clock_time_get');
      expect(f(0, 1n, 0x1000)).to.equal(0);
      const dv = new DataView(env.memory.buffer, 0x1000, 8);
      const time1 = dv.getBigUint64(0, env.littleEndian);
      expect(time1).to.be.above(BigInt(now1) * 1000n);
      const now2 = performance.now();
      expect(f(1, 1n, 0x1000)).to.equal(0);
      const time2 = dv.getBigUint64(0, env.littleEndian);
      expect(time2).to.be.above(BigInt(Math.round(now2 * 1000)));
    })
  }
})
