import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall helper', function() {
  describe('copyUint32', function() {
    it('should write u32 to given address', function() {
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
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }   
      const address = usize(0x3000);
      const number = 1234;
      env.copyUint32(address, number);
      const dv = env.obtainZigView(address, 4);
      const result = dv.getUint32(0, env.littleEndian);
      expect(result).to.equal(number);
    })
  })
  describe('copyUint64', function() {
    it('should write u64 to given address', function() {
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
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }   
      const address = usize(0x3000);
      const number = 1234;
      env.copyUint64(address, number);
      const dv = env.obtainZigView(address, 8);
      const result = dv.getBigUint64(0, env.littleEndian);
      expect(result).to.equal(BigInt(number));
    })
  })
})
