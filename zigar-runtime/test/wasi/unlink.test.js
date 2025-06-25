import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: unlink', function() {
    it('should call listener', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      let event;
      env.addListener('unlink', (evt) => {
        if (event) return false;
        event = evt;
        return true;
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_unlink_file');
      const result1 = f(3, pathAddress, pathLen);
      expect(result1).to.equal(0);
      expect(event).to.eql({ path: '/hello.txt' });
      const result2 = f(3, pathAddress, pathLen);
      expect(result2).to.equal(PosixError.ENOENT);
    })
    it('should display error when listener does not return a boolean', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      env.addListener('unlink', () => undefined);
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_unlink_file');
      let result 
      const [ error ] = await captureError(() => {
        result = f(3, pathAddress, pathLen);
      });
      expect(result).to.equal(PosixError.ENOENT);
      expect(error).to.contain('boolean');
    })
  })
}