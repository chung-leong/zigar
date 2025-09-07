import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: wasi-support', function() {
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