import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: wasi-seek', function() {
    it('should provide a function that changes the read position', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_seek');
      const posAddress = 128;
      const dv = new DataView(memory.buffer);
      env.redirectStream(0, array);
      const result = f(0, -1, 2, posAddress)
      expect(result).to.equal(PosixError.NONE);
      const pos = dv.getUint32(posAddress, true);
      expect(pos).to.equal(10);
    })
    it('should return an error code when whence value is invalid', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_seek');
      const posAddress = 128;
      env.redirectStream(0, array);
      let result;
      const [ error ] = await captureError(() => { 
        result = f(0, -1, 4, posAddress)
      });
      expect(result).to.equal(PosixError.EINVAL);
      expect(error).to.contains('Invalid argument');
    })
  })
}
