import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: fd-prestat-dir-name', function() {
  if (process.env.TARGET === 'wasm') {
    it('should no error when retrieving the name', function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_prestat_dir_name');
      expect(f()).to.equal(PosixError.NONE);
    })
  }  
})
