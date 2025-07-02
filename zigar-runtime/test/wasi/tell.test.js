import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: tell', function() {
    it('should return the read position', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const seek = env.getWASIHandler('fd_seek');
      const f = env.getWASIHandler('fd_tell');
      const posAddress = 128;
      const dv = new DataView(memory.buffer);
      env.redirectStream(0, array);
      seek(0, 1n, 1, posAddress)
      seek(0, 1n, 1, posAddress)
      const result = f(0);
      expect(result).to.equal(PosixError.NONE);
      const pos = dv.getUint32(posAddress, true);
      expect(pos).to.equal(2);
    })
    it('should return an error code when handle is invalid', async function() {
      const env = new Env();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_tell');
      let result;
      const [ error ] = await captureError(() => { 
        result = f(4)
      });
      expect(result).to.equal(PosixError.EBADF);
      expect(error).to.contains('file descriptor');
    })
 })
}