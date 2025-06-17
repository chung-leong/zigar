import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';
import { capture, captureError } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: wasi-support', function() {
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
      it('should provide a function returning ENOSYS when handler is not implemented', function() {
        const env = new Env();
        const f = env.getWASIHandler('args_get');
        expect(f).to.be.a('function');
        expect(f()).to.equal(PosixError.ENOSYS);
      })
      it('should provide a function returning EBADF', function() {
        const env = new Env();
        const f = env.getWASIHandler('fd_prestat_get');
        expect(f).to.be.a('function');
        expect(f()).to.equal(PosixError.EBADF);
      })
      it('should provide a function that throws Exit enception', function() {
        const env = new Env();
        const f = env.getWASIHandler('proc_exit');
        expect(f).to.be.a('function');
        expect(() => f(1)).to.throw(Exit).with.property('code', 1);
      })
      it('should provide a function that writes random bytes at memory location', function() {
        const env = new Env();
        env.memory = new WebAssembly.Memory({ initial: 128 });
        const f = env.getWASIHandler('random_get');
        expect(f(0x1000, 16)).to.equal(0);
        const dv = new DataView(env.memory.buffer, 0x1000, 16);
        let sum = 0;
        for (let i = 0; i < dv.byteLength; i++) {
          sum += dv.getUint8(i);
        }
        expect(sum).to.not.equal(0);
      })
      describe('fd_write', function() {
        it('should provide a function that write to console', async function() {
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
            result = f(1, bufferAddress, 1, writtenAddress);
          });
          expect(result).to.equal(PosixError.NONE);
          expect(line).to.equal(text.trim());
          const written = dv.getUint32(writtenAddress, true);
          expect(written).to.equal(4);
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
              result = f(3, bufferAddress, 1, writtenAddress);
            })
          });
          expect(result).to.equal(PosixError.EBADF);
          expect(line).to.be.undefined;
        })
      })
      describe('fd_read', function() {
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
      describe('fd_seek', function() {
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
      describe('fd_tell', function() {
        it('should provide a function that returns the read position', async function() {
          const env = new Env();
          const encoder = new TextEncoder();
          const array = encoder.encode('Hello world');
          const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
          const seek = env.getWASIHandler('fd_seek');
          const f = env.getWASIHandler('fd_tell');
          const posAddress = 128;
          const dv = new DataView(memory.buffer);
          env.redirectStream(0, array);
          seek(0, 1, 1, posAddress)
          seek(0, 1, 1, posAddress)
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
    })
 })
}