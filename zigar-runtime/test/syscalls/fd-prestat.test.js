import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: fd-prestat-get', function() {
  if (process.env.TARGET === 'wasm') {
    it('should return EBADF', function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_prestat_get');
      expect(f).to.be.a('function');
      const fd = 1;
      const bufAddress = 0x2000;
      const result = f(fd, bufAddress);
      expect(result).to.equal(PosixError.EBADF);
    })
    it('should return no error when descriptor 3 is given', function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_prestat_get');
      const fd = 3;
      const bufAddress = 0x2000;
      const result = f(fd, bufAddress);
      expect(result).to.equal(PosixError.NONE);
      const dv = new DataView(env.memory.buffer);
      const count = dv.getUint8(bufAddress);
      expect(count).to.equal(0);
      const len1 = dv.getUint32(bufAddress + 4, true);
      expect(len1).to.equal(0);
    })
  }
})
