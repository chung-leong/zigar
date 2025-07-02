import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: all', function() {
    describe('setCustomWASI', function() {
      it('should accept a custom interface object', function() {
        const env = new Env();
        const wasi = {
          wasiImport: {
            test: function() {},
          }
        };
        env.setCustomWASI(wasi);
        expect(env.getWASIHandler('test')).to.equal(wasi.wasiImport.test);
      })
      it('should throw if WASM compilation has been initiated already', function() {
        const env = new Env();
        env.executable = {};
        const wasi = { wasiImport: {} };
        expect(() => env.setCustomWASI(wasi)).to.throw();
      })
    })
    describe('getWASIHandler', function() {
      it('should provide a function returning ENOTSUP when handler is not implemented', async function() {
        const env = new Env();
        const f = env.getWASIHandler('args_get')
        expect(f).to.be.a('function');
        let result;
        const [ error ] = await captureError(() => result = f());
        expect(result).to.equal(PosixError.ENOTSUP);
        expect(error).to.contain('Not implemented');
      })
    })
 })
}