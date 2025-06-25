import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: prestat-get', function() {
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
    it('should no error when retrieving the name', function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_prestat_dir_name');
      expect(f()).to.equal(PosixError.NONE);
    })
 })
}