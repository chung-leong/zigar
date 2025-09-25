import { expect } from 'chai';
import { PosixError, PosixFileType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall helper', function() {
  describe('inferStat', function() {
    it('should obtain stat from stream objects', function() {
      const env = new Env();
      const result1 = env.inferStat({ 
        size: 1234, 
        read() {},
      })
      expect(result1).to.eql({ size: 1234, type: 'file' });
      const result2 = env.inferStat({
        readdir() {},
      })
      expect(result2).to.eql({ size: undefined, type: 'directory' });
    })
    it('should return undefined when argument is null', function() {
      const env = new Env();
      const result = env.inferStat(null)
      expect(result).to.be.undefined;
    })
  })
  describe('copyStat', function() {
    it('should write stat to given address', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
        env.moveExternBytes = function(jsDV, address, to) {
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const le = env.littleEndian;
      const address = usize(0x3000);
      env.copyStat(address, {
        size: 1234,
        type: 'file',
        atime: 1000,
        mtime: 2000,
        ctime: 3000,
      });
      const dv = env.obtainZigView(address, 64);      
      const size = dv.getBigUint64(32, le);
      expect(size).to.equal(1234n);
      const type = dv.getUint8(16);
      expect(type).to.equal(PosixFileType.file);
      const atime = dv.getBigUint64(40, le);
      expect(atime).to.equal(1000n);
      const mtime = dv.getBigUint64(48, le);
      expect(mtime).to.equal(2000n);
      const ctime = dv.getBigUint64(56, le);
      expect(ctime).to.equal(3000n);
    })
    it('should write stat to given address', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
        env.moveExternBytes = function(jsDV, address, to) {
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const le = env.littleEndian;
      const address = usize(0x3000);
      env.copyStat(address, {});
      const dv = env.obtainZigView(address, 64);      
      const type = dv.getUint8(16);
      expect(type).to.equal(PosixFileType.unknown);
    })
    it('should throw when type is not among the valid values', function() {
      const env = new Env();
      const address = usize(0x3000);
      expect(() => env.copyStat(address, { type: 'fil' })).to.throw();
    })
    it('should return ENOENT when argument is false', function() {
      const env = new Env();
      const address = usize(0x3000);
      const result = env.copyStat(address, false);
      expect(result).to.equal(PosixError.ENOENT);
    })
    it('should throw when argument is not false or an object', function() {
      const env = new Env();
      const address = usize(0x3000);
      expect(() => env.copyStat(address, 'hello')).to.throw();
    })
  })
})
