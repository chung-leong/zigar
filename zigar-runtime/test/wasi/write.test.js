import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { capture, captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: write', function() {
    it('should write to console', async function() {
      const env = new Env();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_write');
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      dv.setUint32(bufferAddress + 8, stringAddress, true);
      dv.setUint32(bufferAddress + 12, text.length, true);
      let result;
      const [ line1, line2 ] = await capture(() => {
        result = f(1, bufferAddress, 2, writtenAddress);
      });
      expect(result).to.equal(PosixError.NONE);
      expect(line1).to.equal(text.trim());
      expect(line2).to.equal(text.trim());
      const written = dv.getUint32(writtenAddress, true);
      expect(written).to.equal(8);
    })
    it('should write to console when call to fd_write is directed at stderr', async function() {
      const env = new Env();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_write');
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      let result;
      const [ line ] = await capture(() => {
        result = f(2, bufferAddress, 1, writtenAddress);
      });
      expect(result).to.equal(PosixError.NONE);
      expect(line).to.equal(text.trim());
      const written = dv.getUint32(writtenAddress, true);
      expect(written).to.equal(4);
    })
    it('should return error code when file descriptor is not stdout or stderr', async function() {
      const env = new Env();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_write');
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      let result;
      const [ line ] = await capture(async () => {
        const [ error ] = await captureError(async () => {
          result = f(5, bufferAddress, 1, writtenAddress);
        })
      });
      expect(result).to.equal(PosixError.EBADF);
      expect(line).to.be.undefined;
    })
  })
}