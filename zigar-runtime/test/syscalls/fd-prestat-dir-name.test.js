import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: fd-prestat-dir-name', function() {
  if (process.env.TARGET === 'wasm') {
    it('should no error when retrieving the name', function() {
      const env = new Env();
      const result = env.fdPrestatDirName(3);
      expect(result).to.equal(PosixError.NONE);
    })
    it('should fallback to custom WASI', function() {
      const env = new Env();
      env.customWASI = {
        wasiImport: {
          fd_prestat_get() {
            return PosixError.EBADF;
          },
          fd_prestat_dir_name() {
            return PosixError.EBADF;
          },
        }
      };
      const f = env.getWASIHandler('fd_prestat_dir_name');
      const result = f(3);
      expect(result).to.equal(PosixError.EBADF);
    })
  }  
})
