import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: wasi-support', function() {
    describe('setCustomWASI', function() {
      it('should accept a custom interface object', function() {
        const env = new Env();
        const wasi = { wasiImport: {} };
        env.setCustomWASI(wasi);
        expect(env.getWASIImport()).to.equal(wasi.wasiImport);
      })
      it('should throw if WASM compilation has been initiated already', function() {
        const env = new Env();
        env.hasCodeSource = true;
        const wasi = { wasiImport: {} };
        expect(() => env.setCustomWASI(wasi)).to.throw();
      })
    })
    describe('getWASIImport', function() {
      it('should return default WASI import object', function() {
        const env = new Env();
        const imports = env.getWASIImport();
        expect(imports.fd_write).to.be.a('function');
        const ENOSYS = 38;
        const ENOBADF = 8;
        expect(imports.args_get()).to.equal(ENOSYS);
        expect(imports.fd_prestat_get()).to.equal(ENOBADF);
        expect(() => imports.proc_exit(1)).to.throw(Exit).with.property('code', 1);
        env.memory = new WebAssembly.Memory({ initial: 128 });
        expect(imports.random_get(0x1000, 16)).to.equal(0);
        const dv = new DataView(env.memory.buffer, 0x1000, 16);
        let sum = 0;
        for (let i = 0; i < dv.byteLength; i++) {
          sum += dv.getUint8(i);
        }
        expect(sum).to.not.equal(0);
      })
    })
  })
}