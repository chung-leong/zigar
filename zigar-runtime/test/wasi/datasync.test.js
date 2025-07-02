import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: datasync', function() {
    it('should do nothing when stream does not support feature', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const f = env.getWASIHandler('fd_datasync');
      env.redirectStream(0, array);
      const result = f(0);
      expect(result).to.equal(PosixError.NONE);
    })
    it('should call handler when stream has support', async function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_datasync');
      let called;
      const stream = {
        read() {},
        datasync() {
          called = true;
        },
      }
      env.redirectStream(0, stream);
      const result = f(0);
      expect(result).to.equal(PosixError.NONE);
      expect(called).to.be.true;
    })
    it('should return an error code when handle is invalid', async function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_datasync');
      let result;
      const [ error ] = await captureError(() => { 
        result = f(4)
      });
      expect(result).to.equal(PosixError.EBADF);
      expect(error).to.contains('file descriptor');
    })
 })
}