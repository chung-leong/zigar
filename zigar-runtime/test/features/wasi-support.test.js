import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';
import { capture } from '../test-utils.js';

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
        env.hasCodeSource = true;
        const wasi = { wasiImport: {} };
        expect(() => env.setCustomWASI(wasi)).to.throw();
      })
    })
    describe('getWASIHandler', function() {
      const ENOSYS = 38;
      const ENOBADF = 8;
      it('should provide a function returning ENOSYS when handler is not implemented', function() {
        const env = new Env();
        const f = env.getWASIHandler('args_get');
        expect(f).to.be.a('function');
        expect(f()).to.equal(ENOSYS);
      })
      it('should provide a function returning ENOBADF', function() {
        const env = new Env();
        const f = env.getWASIHandler('fd_prestat_get');
        expect(f).to.be.a('function');
        expect(f()).to.equal(ENOBADF);
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
        const [ line ] = await capture(() => {
          f(1, bufferAddress, 1, writtenAddress);
        });
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
        const [ line ] = await capture(() => {
          f(2, bufferAddress, 1, writtenAddress);
        });
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
        const [ line ] = await capture(() => {
          result = f(3, bufferAddress, 1, writtenAddress);
        });
        expect(result).to.not.equal(0);
        expect(line).to.be.undefined;
      })

    })
  })
}