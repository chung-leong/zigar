import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: prestat-get', function() {
    it('should return EBADF', function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_prestat_get');
      expect(f).to.be.a('function');
      expect(f()).to.equal(PosixError.EBADF);
    })
 })
}