import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: exit', function() {
    it('should throws an Exit exception', function() {
      const env = new Env();
      const f = env.getWASIHandler('proc_exit');
      expect(f).to.be.a('function');
      expect(() => f(1)).to.throw(Exit).with.property('code', 1);
    })
  })
}