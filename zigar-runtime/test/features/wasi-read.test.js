import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: wasi-read', function() {
    it('should provide a function that read from a Uint8Array', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_read');
      const bufferAddress = 16;
      const stringAddress = 64;
      const readAddress = 128;
      const dv = new DataView(memory.buffer);
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, array.length, true);
      env.redirectStream(0, array);
      const result = f(0, bufferAddress, 1, readAddress)
      expect(result).to.equal(PosixError.NONE);
      const string = new Uint8Array(memory.buffer, stringAddress, array.length);
      expect(string).to.eql(array);
    })
    it('should fail when reading from an async source from the main thread', async function() {
      const env = new Env();
      const stream = new ReadableStream({
        async pull(controller) {
          controller.close();
        }
      });
      const reader = stream.getReader();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_read');
      const bufferAddress = 16;
      const stringAddress = 64;
      const readAddress = 128;
      const dv = new DataView(memory.buffer);
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, 16, true);
      env.redirectStream(0, reader);
      let result;
      const [ error ] = await captureError(() => {
        result = f(0, bufferAddress, 1, readAddress);
      });
      expect(result).to.equal(PosixError.EDEADLK);
      expect(error).to.contains('promise');
    })
 })
}