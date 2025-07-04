import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: proc-exit', function() {
  if (process.env.TARGET === 'wasm') {
    it('should throws an Exit exception', function() {
      const env = new Env();
      expect(() => env.procExit(1)).to.throw(Exit).with.property('code', 1);
    })
    it('should be callable through WASI', function() {
      const env = new Env();
      const f = env.getWASIHandler('proc_exit');
      expect(f).to.be.a('function');
      expect(() => f(1)).to.throw(Exit).with.property('code', 1);
    })

  }
})
